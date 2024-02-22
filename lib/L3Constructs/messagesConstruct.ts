import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { EventSourceMapping, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";

interface IProps {
  removalPolicy: RemovalPolicy;
  sqsQueue: IQueue;
}

/**
 * Creates a messages dynamo table, s3 bucket and lambda function and creates an event source mapping with sqs queue placed behind the api gw
 */
export class MessagesConstruct extends Construct {
  constructor(scope: Construct, id: string, props: IProps) {
    super(scope, id);

    const { removalPolicy, sqsQueue } = props;

    const messagesTable = new Table(this, `messages-table`, {
      partitionKey: {
        name: "messageId",
        type: AttributeType.STRING,
      },
      removalPolicy: removalPolicy,
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
    const messagesPostLambda = new NodejsFunction(this, "uploader-lambda", {
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
      },
      role: lambdaRole,
    });

    messagesTable.grantWriteData(messagesPostLambda);
    messagesBucket.grantWrite(messagesPostLambda);

    // creates new event source mapping from sqs queue to lambda
    new EventSourceMapping(
      this,
      "QueueConsumerFunctionMySQSEvent",
      {
        target: messagesPostLambda,
        batchSize: 10,
        eventSourceArn: sqsQueue.queueArn,
      }
    );

    new CfnOutput(this, "uploaderlambdaFunctionName", {
      value: messagesPostLambda.functionName,
    });

    new CfnOutput(this, "S3BucketURL", {
      value: messagesBucket.urlForObject(), // bucket URL will be returned.
    });
  }
}
