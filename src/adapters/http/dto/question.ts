export interface QuestionDto {
  i:string; t:string; o:'O'|'A'|'G'; q:string; a:string[]; c:number; k?:string; x?:number[];
  d?:number|null; n?:string; y?:string; u?:string; np?:number;
  source?:{url:string;title?:string;page?:number;verified:boolean}; cp?:string;
  s?:string; p?:number; r?:number; v?:number; w?:number; z?:number; f?:string;
}
