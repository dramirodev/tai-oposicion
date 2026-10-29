export interface AccessRequestDto { email: string; name?: string; ts?: number }
export interface AccessRequestRecord extends AccessRequestDto { uid: string }
