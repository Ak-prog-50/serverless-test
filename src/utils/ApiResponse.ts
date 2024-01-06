import { APIGatewayProxyResult } from 'aws-lambda';

export class ApiResponse implements APIGatewayProxyResult {
  public body: string;
  public headers: any;

  constructor(
    public statusCode: number,
    body: { message: string; data?: any },
  ) {
    this.body = JSON.stringify(body);
    this.headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };
  }
  static success(message: string, data: unknown = null) {
    return new ApiResponse(200, { message, data });
  }

  static created(message: string, data: unknown = null) {
    return new ApiResponse(201, { message, data });
  }
}
