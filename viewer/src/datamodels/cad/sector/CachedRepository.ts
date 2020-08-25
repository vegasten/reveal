/*!
 * Copyright 2020 Cognite AS
 */

import { Repository } from './Repository';
import { WantedSector, SectorGeometry, FlatSectorGeometry, ConsumedSector } from './types';
import { LevelOfDetail } from './LevelOfDetail';
import {
  OperatorFunction,
  Observable,
  from,
  zip,
  Subject,
  onErrorResumeNext,
  defer,
  partition,
  scheduled,
  asyncScheduler,
  merge,
  NextObserver
} from 'rxjs';
import {
  flatMap,
  map,
  tap,
  shareReplay,
  take,
  retry,
  reduce,
  distinct,
  catchError,
  distinctUntilChanged,
  mergeAll
} from 'rxjs/operators';
import { CadSectorParser } from './CadSectorParser';
import { SimpleAndDetailedToSector3D } from './SimpleAndDetailedToSector3D';
import { MemoryRequestCache } from '@/utilities/cache/MemoryRequestCache';
import { ParseCtmInput } from '@/utilities/workers/types/reveal.parser.types';
import { SectorQuads, InstancedMesh, InstancedMeshFile, TriangleMesh } from '@/datamodels/cad/rendering/types';
import { trackError } from '@/utilities/metrics';
import { BinaryFileProvider } from '@/utilities/networking/types';
import { Group } from 'three';
import { RxCounter } from '@/utilities/RxCounter';
import { flatbuffers } from 'flatbuffers';
import { DetailedSector } from '@/datamodels/cad/sector/detailedSector_generated';

type KeyedWantedSector = { key: string; wantedSector: WantedSector };
type WantedSecorWithRequestObservable = {
  key: string;
  wantedSector: WantedSector;
  observable: Observable<ConsumedSector>;
};
type CtmFileRequest = { blobUrl: string; fileName: string };
type CtmFileResult = { fileName: string; data: Uint8Array };
type ParsedData = { blobUrl: string; lod: string; data: SectorGeometry | SectorQuads };

// TODO: j-bjorne 16-04-2020: REFACTOR FINALIZE INTO SOME OTHER FILE PLEZ!
export class CachedRepository implements Repository {
  private readonly _consumedSectorCache: MemoryRequestCache<
    string,
    Observable<ConsumedSector>
  > = new MemoryRequestCache({
    maxElementsInCache: 50
  });
  private readonly _ctmFileCache: MemoryRequestCache<string, Observable<CtmFileResult>> = new MemoryRequestCache({
    maxElementsInCache: 300
  });
  private readonly _modelSectorProvider: BinaryFileProvider;
  private readonly _modelDataParser: CadSectorParser;
  private readonly _modelDataTransformer: SimpleAndDetailedToSector3D;
  private readonly _loadingCounter: RxCounter = new RxCounter();

  // Adding this to support parse map for migration wrapper. Should be removed later.
  private readonly _parsedDataSubject: Subject<{
    blobUrl: string;
    sectorId: number;
    lod: string;
    data: SectorGeometry | SectorQuads;
  }> = new Subject();

  private readonly _concurrentNetworkOperations: number;
  private readonly _concurrentCtmRequests: number;

  constructor(
    modelSectorProvider: BinaryFileProvider,
    modelDataParser: CadSectorParser,
    modelDataTransformer: SimpleAndDetailedToSector3D,
    concurrentNetworkOperations: number = 50,
    concurrentCtmRequest: number = 10
  ) {
    this._modelSectorProvider = modelSectorProvider;
    this._modelDataParser = modelDataParser;
    this._modelDataTransformer = modelDataTransformer;
    this._concurrentNetworkOperations = concurrentNetworkOperations;
    this._concurrentCtmRequests = concurrentCtmRequest;
  }

  clear() {
    this._consumedSectorCache.clear();
    this._ctmFileCache.clear();
  }

  getParsedData(): Observable<ParsedData> {
    return this._parsedDataSubject.pipe(
      distinct(keySelector => '' + keySelector.blobUrl + '.' + keySelector.sectorId + '.' + keySelector.lod)
    ); // TODO: Should we do replay subject here instead of variable type?
  }

  getLoadingStateObserver(): Observable<boolean> {
    return this._loadingCounter.countObservable().pipe(
      distinctUntilChanged(),
      map(count => count != 0)
    );
  }

  // TODO j-bjorne 16-04-2020: Should look into ways of not sending in discarded sectors,
  // unless we want them to eventually set their priority to lower in the cache.

  loadSector(): OperatorFunction<WantedSector, ConsumedSector> {
    return (source$: Observable<WantedSector>) => {
      /* Split wantedSectors into a pipe of discarded wantedSectors and a pipe of simple and detailed wantedSectors.
       * ----------- wantedSectors -----------------------
       * \---------- discarded wantedSectors -------------
       *  \--------- simple and detailed wantedSectors ---
       */
      const [discarded$, simpleAndDetailed$] = partition(
        source$,
        wantedSector => wantedSector.levelOfDetail == LevelOfDetail.Discarded
      );

      /* Split simple and detailed wanted sectors into a pipe of cached request and uncached requests.
       * ----------- simple and detailed wantedSectors ---
       * \---------- cached wantedSectors ----------------
       *  \--------- uncached wantedSectors --------------
       */
      const existsInCache = ({ key }: KeyedWantedSector) => this._consumedSectorCache.has(key);
      const [cached$, uncached$] = partition(
        simpleAndDetailed$.pipe(map(wantedSector => ({ key: this.wantedSectorCacheKey(wantedSector), wantedSector }))),
        existsInCache
      );

      /* Split uncached wanted sectors into a pipe of simple wantedSectors and detailed wantedSectors. Increase load count
       * ----------- uncached wantedSectors --------------
       * \---------- simple wantedSectors ----------------
       *  \--------- detailed wantedSectors --------------
       */
      const [simple$, detailed$] = partition(
        uncached$.pipe(this._loadingCounter.incrementOnNext()),
        ({ wantedSector }) => wantedSector.levelOfDetail == LevelOfDetail.Simple
      );

      /* Merge simple and detailed pipeline, save observable to cache, and decrease loadcount
       */
      const getSimpleSectorFromNetwork = ({ key, wantedSector }: { key: string; wantedSector: WantedSector }) => ({
        key,
        wantedSector,
        observable: this.loadSimpleSectorFromNetwork(wantedSector)
      });

      const getDetailedSectorFromNetwork = ({ key, wantedSector }: { key: string; wantedSector: WantedSector }) => ({
        key,
        wantedSector,
        observable: this.loadDetailedSectorFromNetwork(wantedSector)
      });

      const saveToCache = ({ key, observable }: WantedSecorWithRequestObservable) =>
        this._consumedSectorCache.forceInsert(key, observable);

      const network$ = merge(
        simple$.pipe(map(getSimpleSectorFromNetwork)),
        detailed$.pipe(map(getDetailedSectorFromNetwork))
      ).pipe(
        tap({
          next: saveToCache
        }),
        map(({ observable }) => observable),
        mergeAll(this._concurrentNetworkOperations),
        this._loadingCounter.decrementOnNext()
      );

      const toDiscardedConsumedSector = (wantedSector: WantedSector) =>
        ({ ...wantedSector, group: undefined } as ConsumedSector);

      const getFromCache = ({ key }: KeyedWantedSector) => {
        return this._consumedSectorCache.get(key);
      };

      return scheduled(
        [discarded$.pipe(map(toDiscardedConsumedSector)), cached$.pipe(flatMap(getFromCache)), network$],
        asyncScheduler
      ).pipe(mergeAll(), this._loadingCounter.resetOnComplete());
    };
  }

  private catchWantedSectorError<T>(wantedSector: WantedSector, methodName: string) {
    return catchError<T, Observable<T>>(error => {
      trackError(error, { moduleName: 'CachedRepository', methodName });
      this._consumedSectorCache.remove(this.wantedSectorCacheKey(wantedSector));
      throw error;
    });
  }

  private catchCtmFileError<T>(ctmRequest: CtmFileRequest, methodName: string) {
    return catchError<T, Observable<T>>(error => {
      trackError(error, {
        moduleName: 'CachedRepository',
        methodName
      });
      this._ctmFileCache.remove(this.ctmFileCacheKey(ctmRequest));
      throw error;
    });
  }

  private parsedDataObserver(wantedSector: WantedSector): NextObserver<SectorGeometry | SectorQuads> {
    return {
      next: data => {
        this._parsedDataSubject.next({
          blobUrl: wantedSector.blobUrl,
          sectorId: wantedSector.metadata.id,
          lod: wantedSector.levelOfDetail == LevelOfDetail.Simple ? 'simple' : 'detailed',
          data
        });
      }
    };
  }

  private nameGroup(wantedSector: WantedSector): OperatorFunction<Group, Group> {
    return tap(group => {
      group.name = `Quads ${wantedSector.metadata.id}`;
    });
  }

  private loadSimpleSectorFromNetwork(wantedSector: WantedSector): Observable<ConsumedSector> {
    const networkObservable: Observable<ConsumedSector> = onErrorResumeNext(
      defer(() =>
        this._modelSectorProvider.getBinaryFile(wantedSector.blobUrl, wantedSector.metadata.facesFile.fileName!)
      ).pipe(
        this.catchWantedSectorError(wantedSector, 'loadSimpleSectorFromNetwork'),
        flatMap(buffer => this._modelDataParser.parseF3D(new Uint8Array(buffer))),
        tap(this.parsedDataObserver(wantedSector)),
        map(sectorQuads => ({ ...wantedSector, data: sectorQuads })),
        this._modelDataTransformer.transform(),
        this.nameGroup(wantedSector),
        map(group => ({ ...wantedSector, group })),
        shareReplay(1),
        take(1)
      )
    );
    return networkObservable;
  }

  private loadDetailedSectorFromNetwork(wantedSector: WantedSector): Observable<ConsumedSector> {
    const networkObservable = onErrorResumeNext(
      scheduled(
        defer(() => {
          const indexFile = wantedSector.metadata.indexFile;
          const i3dFileObservable = from(
            this._modelSectorProvider.getBinaryFile(wantedSector.blobUrl, indexFile.fileName)
          ).pipe(retry(3));
          const ctmFilesObservable = from(indexFile.peripheralFiles).pipe(
            map(fileName => ({
              blobUrl: wantedSector.blobUrl,
              fileName
            })),
            this.loadCtmFile(),
            reduce(
              (accumulator, value) => {
                const number = parseInt(value.fileName.replace('mesh_', '').replace('.ctm', ''));
                accumulator.fileIds.push(number);
                accumulator.buffer = [...accumulator.buffer, ...value.data];
                accumulator.lengths.push(value.data.length);
                return accumulator;
              },
              { fileIds: [], lengths: [], buffer: [] } as ParseCtmInput
            )
          );
          return zip(i3dFileObservable, ctmFilesObservable).pipe(
            this.catchWantedSectorError(wantedSector, 'loadDetailedSectorFromNetwork'),
            flatMap(([i3dFile, ctmFiles]) =>
              this._modelDataParser.parseAndFinalizeI3D(
                wantedSector.metadata.indexFile.fileName,
                new Uint8Array(i3dFile),
                ctmFiles
              )
            ),
            map(data => {
              const sector = this.unflattenSector(data);
              return sector;
            }),
            tap(this.parsedDataObserver(wantedSector)),
            map(data => {
              return { ...wantedSector, data };
            }),
            this._modelDataTransformer.transform(),
            map(group => ({ ...wantedSector, group })),
            shareReplay(1),
            take(1)
          );
        }),
        asyncScheduler
      )
    );
    return networkObservable;
  }

  private loadCtmFile(): OperatorFunction<CtmFileRequest, CtmFileResult> {
    return flatMap(ctmRequest => {
      const key = this.ctmFileCacheKey(ctmRequest);
      if (this._ctmFileCache.has(key)) {
        return this._ctmFileCache.get(key);
      } else {
        return this.loadCtmFileFromNetwork(ctmRequest);
      }
    }, this._concurrentCtmRequests);
  }

  private loadCtmFileFromNetwork(ctmRequest: CtmFileRequest): Observable<CtmFileResult> {
    const networkObservable: Observable<{ fileName: string; data: Uint8Array }> = onErrorResumeNext(
      defer(() => this._modelSectorProvider.getBinaryFile(ctmRequest.blobUrl, ctmRequest.fileName)).pipe(
        this.catchCtmFileError(ctmRequest, 'loadCtmFileFromNetwork'),
        retry(3),
        map(data => ({ fileName: ctmRequest.fileName, data: new Uint8Array(data) })),
        shareReplay(1),
        take(1)
      )
    );
    this._ctmFileCache.forceInsert(this.ctmFileCacheKey(ctmRequest), networkObservable);
    return networkObservable;
  }

  private wantedSectorCacheKey(wantedSector: WantedSector) {
    return '' + wantedSector.blobUrl + '.' + wantedSector.metadata.id + '.' + wantedSector.levelOfDetail;
  }

  private ctmFileCacheKey(request: { blobUrl: string; fileName: string }) {
    return '' + request.blobUrl + '.' + request.fileName;
  }

  private unflattenSector(data: FlatSectorGeometry): SectorGeometry {
    const buf = new flatbuffers.ByteBuffer(data.buffer);
    const sectorG = DetailedSector.SectorGeometry.getRootAsSectorGeometry(buf);
    const iMeshes: InstancedMeshFile[] = [];
    for (let i = 0; i < sectorG.instanceMeshesLength(); i++) {
      const instances: InstancedMesh[] = [];
      const meshFile = sectorG.instanceMeshes(i)!;
      for (let j = 0; j < meshFile.instancesLength(); j++) {
        const int = meshFile.instances(j)!;
        const colors = int.colorsArray()!;
        const instanceMatrices = int.instanceMatricesArray()!;
        const treeIndices = int.treeIndicesArray()!;
        instances.push({
          triangleCount: int.triangleCount(),
          triangleOffset: int.triangleOffset(),
          colors,
          instanceMatrices,
          treeIndices
        });
      }
      const indices = meshFile.indicesArray()!;
      const vertices = meshFile.verticesArray()!;
      const norm = meshFile.normalsArray();
      iMeshes.push({
        fileId: meshFile.fileId(),
        indices,
        vertices,
        normals: norm ? norm : undefined,
        instances
      });
    }
    const tMeshes: TriangleMesh[] = [];
    for (let i = 0; i < sectorG.triangleMeshesLength(); i++) {
      const tri = sectorG.triangleMeshes(i)!;
      const indices = tri.indicesArray()!;
      const treeIndices = tri.treeIndicesArray()!;
      const vertices = tri.verticesArray()!;
      const colors = tri.colorsArray()!;
      const norm = tri.normalsArray();
      tMeshes.push({
        fileId: tri.fileId(),
        indices,
        treeIndices,
        vertices,
        normals: norm ? norm : undefined,
        colors
      });
    }
    return {
      instanceMeshes: iMeshes,
      triangleMeshes: tMeshes,
      ...data
    };
  }
}
