export const firestoreIdMapper={toDomain(id:string):string{return id.replace(/~/g,'.');},toDto(id:string):string{return id.replace(/\./g,'~');}};
