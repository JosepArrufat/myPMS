// Base HTTP Error class
export class HttpError extends Error {
    public statusCode: number;
    
    constructor(message: string, statusCode: number) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// 400 Bad Request
export class BadRequestError extends HttpError {
    constructor(message: string = "Bad Request") {
        super(message, 400);
    }
}

// 401 Unauthorized
export class UnauthorizedError extends HttpError {
    constructor(message: string = "Unauthorized") {
        super(message, 401);
    }
}

// 403 Forbidden
export class ForbiddenError extends HttpError {
    constructor(message: string = "Forbidden") {
        super(message, 403);
    }
}

// 404 Not Found
export class NotFoundError extends HttpError {
    constructor(message: string = "Not Found") {
        super(message, 404);
    }
}