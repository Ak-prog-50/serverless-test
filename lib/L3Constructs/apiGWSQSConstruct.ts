import {
  aws_apigateway as apiGw,
  aws_sqs as sqs,
  aws_iam as iam,
  CfnOutput as cfnOutput,
} from "aws-cdk-lib";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { ENVIRONMENT, REMOVAL_POLICY } from "../stack-config";

interface ApiGwSqsProps {
  apiGateway?: apiGw.IRestApi;
  sqsQueue?: sqs.IQueue;
}

/**
 * To create an API Gateway that publish requests to an SQS queue
 */
export class ApiGwSqsConstruct extends Construct {
  readonly customApiGateway: apiGw.IRestApi;
  readonly customQueue: sqs.IQueue;
  readonly messagesResource: apiGw.Resource;

  constructor(scope: Construct, id: string, props: ApiGwSqsProps) {
    super(scope, id);

    const deadLetterQueue = new sqs.Queue(this, "dead-letter-queue");

    // Create SQS queue if not in props;
    this.customQueue =
      props.sqsQueue ??
      new sqs.Queue(this, "apigwSqs-queue", {
        queueName: "serverlessTestQueue",
        deadLetterQueue: {
          queue: deadLetterQueue,
          maxReceiveCount: 2,
        },
      });

    // Create IAM Role for API Gateway
    const integrationRole = new iam.Role(this, "apigwSqs-integration-role", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    // Grant sqs:SendMessage* to Api Gateway Role
    this.customQueue.grantSendMessages(integrationRole);

    // AWS Integration
    const apiGwSqsIntegration = new apiGw.AwsIntegration({
      service: "sqs",
      path: `${process.env.CDK_DEFAULT_ACCOUNT}/${this.customQueue.queueName}`,
      integrationHttpMethod: "POST",
      options: {
        credentialsRole: integrationRole,
        requestParameters: {
          "integration.request.header.Content-Type": `'application/x-www-form-urlencoded'`,
        },
        requestTemplates: {
          "application/json": "Action=SendMessage&MessageBody=$input.body",
        },
        integrationResponses: [
          {
            statusCode: "200",
          },
          {
            statusCode: "400",
          },
          {
            statusCode: "500",
          },
        ],
      },
    });

    // API Gateway & access logs for API gw
    const logGroup = new LogGroup(this, "accessLogs", {
      retention: RetentionDays.ONE_DAY,
      removalPolicy: REMOVAL_POLICY,
    });
    this.customApiGateway =
      props.apiGateway ??
      new apiGw.RestApi(this, "ServerlessTestRestAPI", {
        restApiName: "servelress-test-api",
        defaultCorsPreflightOptions: {
          allowOrigins: apiGw.Cors.ALL_ORIGINS,
          allowMethods: apiGw.Cors.ALL_METHODS,
        },
        deployOptions: {
          stageName: ENVIRONMENT, // ENVIRONEMENT name is dev / prod / staging
          //* Uncomment below if logs are needed. Should manually create an account wide IAM role ( per region ) to grant cloudwatch logs write permissions to all APIs.
          // accessLogDestination: new apiGw.LogGroupLogDestination(logGroup),
          // accessLogFormat: apiGw.AccessLogFormat.custom(
          //   `{"requestTime":"${apiGw.AccessLogField.contextRequestTime()}","requestId":"${
          //     apiGw.AccessLogField.contextRequestId
          //   }","httpMethod":"${
          //     apiGw.AccessLogField.contextHttpMethod
          //   }","path":"$context.path","resourcePath":"$context.resourcePath","status":$context.status,"responseLatency":$context.responseLatency}`
          // ),
        },
      });

    // messages resource and Post method
    this.messagesResource = this.customApiGateway.root.addResource("messages");
    this.messagesResource.addMethod("POST", apiGwSqsIntegration, {
      methodResponses: [
        {
          statusCode: "400",
        },
        {
          statusCode: "200",
        },
        {
          statusCode: "500",
        },
      ],
    });

    new cfnOutput(this, "SqsQueueName", { value: this.customQueue.queueName });
    new cfnOutput(this, "SqsEndpoint", { value: this.customQueue.queueUrl });
  }
}
