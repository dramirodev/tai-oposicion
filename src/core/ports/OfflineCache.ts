export interface OfflineCache { downloadForOffline():Promise<void>; isAvailable(url:string):Promise<boolean> }
