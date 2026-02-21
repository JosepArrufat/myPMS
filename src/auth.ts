import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './errors.js';
import { Request } from "express";
import { randomBytes } from 'crypto';

export async function hashPassword(password: string):Promise<string>{
    const hashedPassword = await argon2.hash(password);
    return hashedPassword;
}

export async function checkPasswordHash(password: string, hash: string):Promise<boolean>{
    try{
        if(await argon2.verify(hash, password)){
            return true;
        }else{
            return false;
        }
    }catch(err){
        throw new Error("Internal Failure");
    }
}

type payload = Pick<jwt.JwtPayload, "iss" | "sub" | "iat" | "exp">;

export function makeJWT(userID: string, expiresIn: number, secret:string):string{ 
    const payload:payload = {
        iss: "chirpy",
        sub: userID,
        iat: Math.floor(Date.now()/1000),
        exp: Math.floor(Date.now()/1000) + expiresIn,
    }
    return jwt.sign(payload, secret);
}

export function validateJWT(tokenString: string, secret: string): string{
    try {
        const validate = jwt.verify(tokenString, secret);
        if(!validate) throw new UnauthorizedError();
        const payload = validate as jwt.JwtPayload;
        return payload.sub || "";
    } catch (error: any) {
        if (error.name === 'TokenExpiredError' || error.message === 'jwt expired') {
            throw new UnauthorizedError("Token has expired");
        }
        throw new UnauthorizedError();
    }
}

export function getBearerToken(req: Request): string {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
        throw new UnauthorizedError("Authorization header missing");
    }
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;   
    if (!headerValue.startsWith('Bearer ')) {
        throw new UnauthorizedError("Authorization header must start with 'Bearer '");
    }    
    const token = headerValue.substring(7); 
    if (!token.trim()) {
        throw new UnauthorizedError("Token missing from Authorization header");
    }
    return token;
}

export function makeRefreshToken(): string{
    const token = randomBytes(256);
    return token.toString("hex");
}

export function getApiKey(req: Request): string{
    const apiHeader = req.get("authorization");
    if (!apiHeader) {
        throw new UnauthorizedError();
    }
    const apiString = Array.isArray(apiHeader) ? apiHeader[0] : apiHeader;
    if(!apiString.startsWith("ApiKey ")){
        throw new UnauthorizedError();
    }
    const apiKey = apiString.substring(7); 
    if(!apiKey) throw new UnauthorizedError();
    return apiKey;
}