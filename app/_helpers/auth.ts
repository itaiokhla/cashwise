import jose, {jwtVerify, type JWTPayload} from 'jose';

export const auth = async (token:string) => {
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.NEXTAUTH_SECRET!));
        if (!payload?.access) {
            return false
        }
        return payload?.access;
    } catch (error) {
        return false
    }
}

export const roleAuth = (roles:string[],role:string) => {
    if(roles.includes(role)){
        return true;
    }
    return false;
}
