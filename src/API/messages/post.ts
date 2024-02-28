import { SQSHandler } from "aws-lambda";
import { ApiError } from "../../utils/ApiError";
import { env } from "process";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";
import { ApiResponse } from "../../utils/ApiResponse";

const { MESSAGES_BUCKET_NAME, MESSAGES_TABLE_NAME, RESPONSE_QUEUE_URL } = env;
const s3Client = new S3Client({});
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const sqsClient = new SQSClient({});

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
  if (!MESSAGES_BUCKET_NAME || !MESSAGES_TABLE_NAME || !RESPONSE_QUEUE_URL)
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

  await s3Client.send(
    new PutObjectCommand({
      Bucket: MESSAGES_BUCKET_NAME,
      Key: `${company_id}/${message_id}.json`,
      Body: JSON.stringify(message),
    })
  );

  await docClient.send(
    new PutCommand({
      TableName: MESSAGES_TABLE_NAME,
      Item: {
        messageId: message_id,
        message: JSON.stringify(message),
      },
    })
  );
};

const sendMessageToSQS = async (queueUrl: string, body: ApiResponse | ApiError) => {
  await sqsClient.send(
    new SendMessageBatchCommand({
      QueueUrl: queueUrl,
      Entries: [
        {
          Id: Date.now().toString(), // Unique id for the message, consider a more robust unique identifier
          MessageBody: JSON.stringify(body),
        },
      ],
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

      await sendMessageToSQS(
        RESPONSE_QUEUE_URL as string,
        ApiResponse.success(`Message processed and stored: ${record.messageId}`)
      );
    } catch (error: any) {
      console.error("Error processing: ", record.messageId, error);
      await sendMessageToSQS(
        RESPONSE_QUEUE_URL as string,
        ApiError.internal(
          `Error processing message: ${record.messageId}, Error: ${error.message}`
        )
      );
      if (!(error instanceof ApiError)) {
        throw error; // Rethrow error for AWS Lambda to handle the retry
      }
    }
  }
};
