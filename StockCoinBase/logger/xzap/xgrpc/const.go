package xgrpc

import (
	"context"

	"github.com/golang/protobuf/jsonpb"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/locey/CryptoStock/StockCoinBase/logger/xzap"

	logging "github.com/locey/CryptoStock/StockCoinBase/logger"
)

var (
	// SystemField 日志系统域
	SystemField = zap.String("system", "grpc")

	// ServerField 服务端日志
	ServerField = zap.String("span.kind", "server")

	// ClientField 客户端日志
	ClientField = zap.String("span.kind", "client")

	// JsonPbMarshaller 序列化protobuf消息
	JsonPbMarshaller logging.JsonPbMarshaler = &jsonpb.Marshaler{}

	defaultOptions       = newDefaultOptions()
	defaultClientOptions = newDefaultClientOptions()
)

func newDefaultOptions() *xzap.Options {
	options := xzap.NewDefaultOption()
	opts := []xzap.Option{xzap.WithMessageProducer(GrpcMessageProducer)}
	for _, o := range opts {
		o(options)
	}

	return options
}

func newDefaultClientOptions() *xzap.Options {
	options := xzap.NewDefaultClientOption()
	opts := []xzap.Option{xzap.WithMessageProducer(GrpcMessageProducer)}
	for _, o := range opts {
		o(options)
	}

	return options
}

// GrpcRecoveryHandlerFunc 恐慌默认处理
func GrpcRecoveryHandlerFunc(ctx context.Context, p interface{}) (err error) {
	err = status.Errorf(codes.Internal, "%v", p)
	cl := xzap.WithContext(ctx)
	cl.Panic("panic", zap.Error(err))

	return err
}

// GrpcMessageProducer 写日志
func GrpcMessageProducer(ctx context.Context, msg string, level zapcore.Level, err error, fields []zapcore.Field) {
	// 重新从上下文提取日志
	fields = append(fields, zap.Error(err))
	cl := xzap.WithContext(ctx)
	cl.Extract().Check(level, msg).Write(fields...)
}
