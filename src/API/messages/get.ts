import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";

const { MESSAGES_TABLE_NAME, COMPANY_INDEX_NAME } = process.env; // Ensure these are set in your Lambda's environment variables
const docClient = new DynamoDBClient({});

const validateEnvVars = () => {
  if (!MESSAGES_TABLE_NAME || !COMPANY_INDEX_NAME) {
    throw ApiError.internal(
      "Environment variables for table name and index name must be set"
    );
  }
};

const getMessageById = async (messageId: string) => {
  // Get a specific message by messageId
  const params = {
    TableName: MESSAGES_TABLE_NAME,
    Key: {
      messageId: { S: messageId },
    },
  };

  const { Item } = await docClient.send(new GetItemCommand(params));
  const message = Item ? unmarshall(Item) : null;
  return message;
};

const getMessagesByCompanyId = async (
  companyId: string,
  startKey: string | undefined
) => {
  const queryCommand = new QueryCommand({
    TableName: MESSAGES_TABLE_NAME,
    IndexName: COMPANY_INDEX_NAME,
    KeyConditionExpression: "companyId = :companyId",
    ExpressionAttributeValues: {
      ":companyId": { S: companyId },
    },
    Limit: 10, // Number of items to return (for pagination)
    ExclusiveStartKey: startKey
      ? JSON.parse(decodeURIComponent(startKey))
      : undefined,
  });
  const { Items, LastEvaluatedKey } = await docClient.send(queryCommand);
  if (!Items) throw ApiError.internal("Items are undefined!");

  const messages = Items.map((item) => unmarshall(item));
  return { messages, LastEvaluatedKey };
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    validateEnvVars();
    const companyId = event.queryStringParameters?.companyId;
    const messageId = event.queryStringParameters?.messageId;
    const startKey = event.queryStringParameters?.startKey;

    if (messageId) {
      const message = await getMessageById(messageId);
      return ApiResponse.success("", { message });
    } else if (companyId) {
      const { messages, LastEvaluatedKey } = await getMessagesByCompanyId(
        companyId,
        startKey
      );
      return ApiResponse.success("", {
        messages,
        lastEvaluatedKey: LastEvaluatedKey
          ? encodeURIComponent(JSON.stringify(LastEvaluatedKey))
          : null,
      });
    } else {
      throw ApiError.badRequest(
        "Query parameter companyId or messageId is required"
      );
    }
  } catch (error) {
    console.error(error);
    const retError =
      error instanceof ApiError
        ? error
        : ApiError.internal("Intrenal Server Error");
    return retError;
  }
};
