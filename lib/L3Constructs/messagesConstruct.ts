import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { EventSourceMapping, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import { LambdaIntegration, Resource } from "aws-cdk-lib/aws-apigateway";

interface IProps {
  /**@responseQueue - SQS Queue to store Lambda function responses */
  removalPolicy: RemovalPolicy;
  msgsPostRouteQueue: IQueue;
  messagesResource: Resource;
  // responseQueue: IQueue;
}

/**
 * Creates a messages dynamo table, s3 bucket and lambda function to
 * handle POST request messages and an event source mapping with
 * sqs queue placed behind the api gateway.
 */
export class MessagesConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, id);

    const { removalPolicy, msgsPostRouteQueue, messagesResource } = props;

    const messagesTable = new Table(this, `messages-table`, {
      partitionKey: {
        name: "messageId",
        type: AttributeType.STRING,
      },
      removalPolicy: removalPolicy,
    });

    const companyIdIndexName = "companyIdIndex";
    messagesTable.addGlobalSecondaryIndex({
      indexName: "companyIdIndex",
      partitionKey: { name: "companyId", type: AttributeType.STRING },
    });

    const messagesBucket = new Bucket(this, "messages-bucket", {
      removalPolicy: removalPolicy,
    });

    const lambdaRole = new iam.Role(this, "uploaderlambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaSQSQueueExecutionRole"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    const lambdaFunctionCodeEntry = `src/API/messages`;
    const messagesPostLambda = new NodejsFunction(
      this,
      "messages-post-lambda",
      {
        functionName: `messages-post-lambda`,
        runtime: Runtime.NODEJS_18_X,
        handler: "handler",
        entry: `${lambdaFunctionCodeEntry}/post.ts`,
        timeout: Duration.seconds(25),
        memorySize: 256,
        bundling: {
          minify: true,
        },
        environment: {
          MESSAGES_BUCKET_NAME: messagesBucket.bucketName,
          MESSAGES_TABLE_NAME: messagesTable.tableName,
          // RESPONSE_QUEUE_URL: responseQueue.queueUrl
        },
        role: lambdaRole,
      }
    );

    const messagesGetLambda = new NodejsFunction(this, "messages-get-lambda", {
      functionName: `messages-get-lambda`,
      runtime: Runtime.NODEJS_18_X,
      handler: "handler",
      entry: `${lambdaFunctionCodeEntry}/get.ts`,
      timeout: Duration.seconds(25),
      memorySize: 256,
      bundling: {
        minify: true,
      },
      environment: {
        MESSAGES_TABLE_NAME: messagesTable.tableName,
        COMPANY_INDEX_NAME: companyIdIndexName,
      },
    });

    messagesTable.grantWriteData(messagesPostLambda);
    messagesBucket.grantWrite(messagesPostLambda);
    messagesTable.grantReadData(messagesGetLambda);

    // creates new event source mapping from sqs queue to lambda
    new EventSourceMapping(this, "QueueConsumerFunctionMySQSEvent", {
      target: messagesPostLambda,
      batchSize: 1,
      eventSourceArn: msgsPostRouteQueue.queueArn,
    });

    // get method
    messagesResource.addMethod("GET", new LambdaIntegration(messagesGetLambda));

    new CfnOutput(this, "S3BucketURL", {
      value: messagesBucket.urlForObject(), // bucket URL will be returned.
    });
  }
}
