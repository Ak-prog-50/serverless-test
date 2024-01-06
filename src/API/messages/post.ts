import { APIGatewayProxyHandler } from "aws-lambda";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { env } from "process";

const { MESSAGES_BUCKET_NAME, MESSAGES_TABLE_NAME } = env;

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (!MESSAGES_BUCKET_NAME || !MESSAGES_TABLE_NAME)
      throw ApiError.internal("ENV variables are not set!");
    const requestBody = event.body && JSON.parse(event.body);
    if (!requestBody || Object.keys(requestBody).length !== 1)
      throw ApiError.badRequest("Invalid request body!");
    const message = requestBody.message;
    const expectedKeys = ["message_time", "company_id", "message_id"];
    const isMessageValid = expectedKeys.every(key => key in message.metadata && message.metadata[key]);
    if (!isMessageValid) throw ApiError.badRequest("Message is Invalid!")

    // write to s3
    // write to dynamo

    return ApiResponse.success("Messages procced and stored!");
  } catch (error) {
    return ApiError.internal("Internal Server Error");
  }
};
