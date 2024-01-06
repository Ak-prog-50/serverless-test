import { APIGatewayProxyResult } from "aws-lambda";

export class ApiError extends Error implements APIGatewayProxyResult {
  public body: string;
  public headers: any;

  constructor(
    public statusCode: number,
    body: { name: string; message: string; data?: any }
  ) {
    super();
    this.body = JSON.stringify(body);
    this.headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };
  }

  static badRequest(message: string, name: string = "Bad Request") {
    return new ApiError(400, { name, message });
  }

  static notAllowed(message: string, name: string = "Not Allowed") {
    return new ApiError(401, { name, message });
  }

  static notFound(message: string, name: string = "Not Found") {
    return new ApiError(404, { name, message });
  }

  static internal(message: string, name: string = "error", data: any = null) {
    return new ApiError(500, { name, message, data });
  }
}
