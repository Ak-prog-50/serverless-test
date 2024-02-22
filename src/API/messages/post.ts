import { APIGatewayProxyHandler, SQSHandler } from "aws-lambda";
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

// Request event's body should be a JSON stringified object of this type
type TRequestBody = {
  message: {
    metadata: {
      message_time: string;
      company_id: string;
      message_id: string;
    };
    data: {
      order_id: string;
      order_time: string;
      order_amount: number;
    };
  };
};

export const handler: SQSHandler = async (event) => {
  try {
    if (!MESSAGES_BUCKET_NAME || !MESSAGES_TABLE_NAME)
      throw ApiError.internal("ENV variables are not set!");
    const requestBody: TRequestBody = JSON.parse(event.Records[0].body);
    console.log("request body", requestBody); //  could records[0] be a problem since batch size is 10?
    if (!requestBody || Object.keys(requestBody).length !== 1)
      throw ApiError.badRequest("Invalid request body!");

    const message = requestBody.message;

    // message validation logic - all field in metadata are required.
    const expectedKeys = ["message_time", "company_id", "message_id"] as const;
    const isMessageValid =
      message.metadata &&
      expectedKeys.every(
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

    // return ApiResponse.success("Messages procced and stored!");
    // TODO: take care of return
  } catch (error) {
    console.error(error);
    const retError =
      error instanceof ApiError
        ? error
        : ApiError.internal("Intrenal Server Error");
    // return retError;
    // TODO: take care of return
  }
};
