import type {Question} from '../domain/entities.js';
export interface BankRepository { getQuestion(id:string):Promise<Question|undefined>; getQuestions(topicIds:readonly string[]):Promise<Question[]> }
