import {config} from './config.js';

// Preview is enabled only by the preview build's generated config. Query strings,
// local storage, and an unconfigured production bundle cannot turn it on.
if(config.previewWorkflow===true&&!config.supabaseUrl&&!config.publishableKey){
  await import('./preview-app.js');
}else{
  await import('./app.js');
}
