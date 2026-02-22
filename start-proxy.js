import { IFlowCLIProxy } from './dist/iflow/proxy.js';

const proxy = new IFlowCLIProxy();
proxy.start().then(() => {
  console.log('Proxy started at:', proxy.getBaseUrl());
});

setInterval(() => {}, 1000);
