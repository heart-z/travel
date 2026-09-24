import {validDate} from './dates';

export type TripStatus = {phase:'upcoming'|'active'|'finished';label:string;description:string};

function daysBetween(from:string,to:string):number {
 return Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);
}

export function tripStatus(startDate:string,endDate:string,currentDate:string):TripStatus {
 if(!validDate(startDate)||!validDate(endDate)||!validDate(currentDate)||endDate<startDate) throw new Error('旅行日期无效');
 if(currentDate<startDate){
  const remaining=daysBetween(currentDate,startDate);
  return {phase:'upcoming',label:remaining===1?'明天出发':`${remaining}天后出发`,description:`距离出发还有 ${remaining} 天`};
 }
 if(currentDate<=endDate){
  const day=daysBetween(startDate,currentDate)+1;
  return {phase:'active',label:`出行第${day}天`,description:`旅行进行中，今天是第 ${day} 天`};
 }
 return {phase:'finished',label:'行程已结束',description:'旅行日期已结束，行程仍可编辑'};
}
