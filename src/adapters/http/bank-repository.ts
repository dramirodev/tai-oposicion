import type {BankRepository} from '../../core/ports/index.js';
import type {Question} from '../../core/domain/entities.js';
import type {QuestionDto} from './dto/question.js';
import {questionMapper} from './mappers/question.js';
export function createHttpBankRepository(loadTopic:(topicId:string)=>Promise<QuestionDto[]>,topicForQuestion:(questionId:string)=>Promise<string|undefined>):BankRepository{
 const topics=new Map<string,Promise<Question[]>>(),byId=new Map<string,Question>();
 const load=(topicId:string)=>{let promise=topics.get(topicId);if(!promise){promise=loadTopic(topicId).then(rows=>{const mapped:Question[]=[];for(const row of rows){const result=questionMapper.toDomain(row);if(result.ok){mapped.push(result.value);byId.set(result.value.id,result.value);}}return mapped;}).catch(error=>{topics.delete(topicId);throw error;});topics.set(topicId,promise);}return promise;};
 return {async getQuestion(id){const present=byId.get(id);if(present)return present;const topic=await topicForQuestion(id);if(!topic)return undefined;await load(topic);return byId.get(id);},async getQuestions(topicIds){return (await Promise.all(topicIds.map(load))).flat();}};
}
