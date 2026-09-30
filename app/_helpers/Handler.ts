import { NextResponse } from "next/server";

interface DataType {
    type?: 'SUCCESS' | 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'ERROR',
    data?: any,
    message?: string,
    status?: number
}

const handleResponse = (data: DataType) => {
    const response: DataType = { ...data };
    delete response.type;

    switch (data.type) {
        case 'SUCCESS':
            response.status = 200;
            break;
        case 'BAD_REQUEST':
            response.status = 400;
            break;
        case 'UNAUTHORIZED':
            response.status = 401;
            break;
        case 'FORBIDDEN':
            response.status = 403;
            break;
        case 'NOT_FOUND':
            response.status = 404;
            break;
        case 'ERROR':
            response.status = 500;
            if (!response.message) {
                response.message = 'Internal Server error';
            }
            break;
    }
    delete data.type
    return NextResponse.json(data, { status: response.status })
};

export default handleResponse