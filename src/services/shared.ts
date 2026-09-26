import {callCloud} from './cloud';
import type {Trip} from '../domain/types';
import type {SharedTripRecord} from '../domain/shared-trips';

export interface InviteInfo {code:string;shareId:string;expiresAt:number;title:string;}
export interface InvitePreview {title:string;city:string;startDate:string;endDate:string;}
export interface SharedMember {memberId:string;name:string;role:'owner'|'editor'|'viewer';pendingEdit:boolean;}

export const createInvite=(tripId:string)=>callCloud<InviteInfo>('createInvite',{tripId});
export const peekInvite=(code:string)=>callCloud<InvitePreview>('peekInvite',{code});
export const joinInvite=(code:string,name:string)=>callCloud<SharedTripRecord>('joinInvite',{code,name});
export const listShared=()=>callCloud<SharedTripRecord[]>('listShared');
export const saveShared=(shareId:string,version:number,trip:Trip)=>callCloud<SharedTripRecord>('saveShared',{shareId,version,trip});
export const sharedMembers=(shareId:string)=>callCloud<SharedMember[]>('members',{shareId});
export const requestEdit=(shareId:string)=>callCloud<{pendingEdit:boolean}>('requestEdit',{shareId});
export const approveEdit=(shareId:string,memberId:string)=>callCloud<{approved:boolean}>('approveEdit',{shareId,memberId});
