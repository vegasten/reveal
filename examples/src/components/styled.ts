/*
 * Copyright 2020 Cognite AS
 */
import styled from 'styled-components';

export const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export const CanvasWrapper = styled(Container)`
  position: relative;
  outline: 1px solid red;
  max-height: 100vh;
  & > canvas {
    outline: 1px dashed blue;
    max-height: 100%;
    min-height: 100%;
    max-width: 100%;
    min-width: 100%;
    //display: block;
  }
`;

export const Loader = styled.div<{ isLoading: boolean }>`
  background: black;
  color: white;
  display: ${(props) => (props.isLoading ? 'block' : 'none')};
`;
