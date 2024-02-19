import * as cdk from "aws-cdk-lib";
import * as apiGw from "aws-cdk-lib/aws-apigateway";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { env } from "process";
import { MessagesConstruct } from "./L3Constructs/messagesConstruct";
import * as dotenv from 'dotenv';
dotenv.config();

const REMOVAL_POLICY =
  env.ENVIRONMENT === "dev"
    ? cdk.RemovalPolicy.DESTROY
    : cdk.RemovalPolicy.RETAIN;

export class ServerlessTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
      //* Uncomment below if logs are needed. Should manually create an account wide IAM role ( per region ) to grant cloudwatch logs write permissions to all APIs.
      // deployOptions: {
      //   accessLogDestination: new apiGw.LogGroupLogDestination(logGroup),
      //   accessLogFormat: apiGw.AccessLogFormat.custom(
      //     `{"requestTime":"${apiGw.AccessLogField.contextRequestTime()}","requestId":"${
      //       apiGw.AccessLogField.contextRequestId
      //     }","httpMethod":"${
      //       apiGw.AccessLogField.contextHttpMethod
      //     }","path":"$context.path","resourcePath":"$context.resourcePath","status":$context.status,"responseLatency":$context.responseLatency}`
      //   ),
      // },
    });

    new MessagesConstruct(this, "messagesConstrcut", {
      removalPolicy: REMOVAL_POLICY,
      restApi: restApi,
    });
  }
}
