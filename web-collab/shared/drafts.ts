export function cloneDraft<T>(value:T):T{return JSON.parse(JSON.stringify(value))}
export function pendingMutation<T extends Record<string,any>>(command:T,store:Map<string,any>):T&{mutationId:string}{const key=JSON.stringify(command);if(!store.has(key))store.set(key,{...cloneDraft(command),mutationId:command.mutationId||crypto.randomUUID()});return store.get(key)}
