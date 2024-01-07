import * as cdk from "aws-cdk-lib";
import * as apiGw from "aws-cdk-lib/aws-apigateway";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { env } from "process";

const REMOVAL_POLICY =
  env.ENVIRONMENT === "dev"
    ? cdk.RemovalPolicy.DESTROY
    : cdk.RemovalPolicy.RETAIN;

export class ServerlessTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const messagesTable = new Table(this, `messages-table`, {
      partitionKey: {
        name: "messageId",
        type: AttributeType.STRING,
      },
      removalPolicy: REMOVAL_POLICY,
    });

    const messagesBucket = new Bucket(this, "messages-bucket", {
      removalPolicy: REMOVAL_POLICY,
    });

    const lambdaFunctionCodeEntry = `src/API/messages`;
    const messagesPostLambda = new NodejsFunction(this, "uploader-lambda", {
      functionName: `messages-post-lambda`,
      runtime: Runtime.NODEJS_18_X,
      handler: "handler",
      entry: `${lambdaFunctionCodeEntry}/post.ts`,
      timeout: cdk.Duration.seconds(25),
      memorySize: 256,
      bundling: {
        minify: true,
      },
      environment: {
        MESSAGES_BUCKET_NAME: messagesBucket.bucketName,
        MESSAGES_TABLE_NAME: messagesTable.tableName,
      },
    });

    messagesTable.grantWriteData(messagesPostLambda);
    messagesBucket.grantWrite(messagesPostLambda);

    // API Gateway & access logs for API gw
    const logGroup = new LogGroup(this, "accessLogs", {
      retention: RetentionDays.ONE_DAY,
      removalPolicy: REMOVAL_POLICY,
    });
    const restApi = new apiGw.RestApi(this, "ServerlessTestRestAPI", {
      restApiName: "servelress-test-api",
      defaultCorsPreflightOptions: {
        allowOrigins: apiGw.Cors.ALL_ORIGINS,
        allowMethods: apiGw.Cors.ALL_METHODS,
      },
      //* need to manually create an account wide IAM role ( per region ) to grant cloudwatch logs write permissions to all APIs.
      deployOptions: {
        accessLogDestination: new apiGw.LogGroupLogDestination(logGroup),
        accessLogFormat: apiGw.AccessLogFormat.custom(
          `{"requestTime":"${apiGw.AccessLogField.contextRequestTime()}","requestId":"${
            apiGw.AccessLogField.contextRequestId
          }","httpMethod":"${
            apiGw.AccessLogField.contextHttpMethod
          }","path":"$context.path","resourcePath":"$context.resourcePath","status":$context.status,"responseLatency":$context.responseLatency}`
        ),
      },
    });

    const messagesResource = restApi.root.addResource("messages");

    const messagesPostIntegration = new apiGw.LambdaIntegration(
      messagesPostLambda
    );
    messagesResource.addMethod("POST", messagesPostIntegration);
  }
}
