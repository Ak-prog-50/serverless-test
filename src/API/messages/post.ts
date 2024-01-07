import { APIGatewayProxyHandler } from "aws-lambda";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { env } from "process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const { MESSAGES_BUCKET_NAME, MESSAGES_TABLE_NAME } = env;
const s3Client = new S3Client({});
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (!MESSAGES_BUCKET_NAME || !MESSAGES_TABLE_NAME)
      throw ApiError.internal("ENV variables are not set!");
    const requestBody = event.body && JSON.parse(event.body);
    if (!requestBody || Object.keys(requestBody).length !== 1)
      throw ApiError.badRequest("Invalid request body!");
    const message = requestBody.message;
    const expectedKeys = ["message_time", "company_id", "message_id"];
    const isMessageValid = expectedKeys.every(
      (key) => key in message.metadata && message.metadata[key]
    );
    if (!isMessageValid) throw ApiError.badRequest("Message is Invalid!");

    const { message_id, company_id } = message.metadata;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: MESSAGES_BUCKET_NAME,
        Key: `${company_id}/${message_id}.json`,
        Body: JSON.stringify(message),
      })
    );

    const command = new PutCommand({
      TableName: MESSAGES_TABLE_NAME,
      Item: {
        messageId: message_id,
        message: JSON.stringify(message),
      },
    });

    await docClient.send(command);

    return ApiResponse.success("Messages procced and stored!");
  } catch (error) {
    console.error(error);
    const retError =
      error instanceof ApiError
        ? error
        : ApiError.internal("Intrenal Server Error");
    return retError;
  }
};
