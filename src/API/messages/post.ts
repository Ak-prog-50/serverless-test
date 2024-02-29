import { SQSHandler } from "aws-lambda";
import { ApiError } from "../../utils/ApiError";
import { env } from "process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const { MESSAGES_BUCKET_NAME, MESSAGES_TABLE_NAME } = env;
const s3Client = new S3Client({});
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

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

const validateEnvVariables = () => {
  if (!MESSAGES_BUCKET_NAME || !MESSAGES_TABLE_NAME)
    throw ApiError.internal("Environment variables are not set!");
};

const validateMessage = (message: any) => {
  const expectedKeys = ["message_time", "company_id", "message_id"] as const;
  return (
    message.metadata &&
    expectedKeys.every(
      (key) => key in message.metadata && message.metadata[key]
    )
  );
};

const persistMessage = async (message: TRequestBody["message"]) => {
  const { message_id, company_id } = message.metadata;

  // Attempt to save the message to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: MESSAGES_BUCKET_NAME,
      Key: `${company_id}/${message_id}.json`,
      Body: JSON.stringify(message),
    })
  );

  // Save the message and its processing status to DynamoDB
  await docClient.send(
    new PutCommand({
      TableName: MESSAGES_TABLE_NAME,
      Item: {
        messageId: message_id,
        companyId: company_id,
        message: JSON.stringify(message),
        status: "Processed", // Indicate success
      },
    })
  );
};

export const handler: SQSHandler = async (event) => {
  validateEnvVariables();

  for (const record of event.Records) {
    try {
      console.log("Processing record", record.messageId);
      const requestBody: TRequestBody = JSON.parse(record.body);
      if (!validateMessage(requestBody.message)) {
        throw ApiError.badRequest("Invalid message format");
      }

      await persistMessage(requestBody.message);

      console.log(`Message processed and stored: ${record.messageId}`);
    } catch (error: any) {
      console.error("Error processing: ", record.messageId, error);

      // Update the processing status in DynamoDB with error details
      const requestBody: TRequestBody = JSON.parse(record.body);
      const { message_id, company_id } = requestBody.message.metadata;

      const retError =
        error instanceof ApiError
          ? ApiError
          : ApiError.internal(`Error processing message: ${record.messageId}`);
      await docClient.send(
        new PutCommand({
          TableName: MESSAGES_TABLE_NAME,
          Item: {
            messageId: message_id,
            companyId: company_id,
            error: JSON.stringify(retError), // Store error
            status: "Failed", // Indicate failure
          },
        })
      );

      if (!(error instanceof ApiError)) {
        throw error; // Rethrow error for AWS Lambda to handle the retry
      }
    }
  }
};
