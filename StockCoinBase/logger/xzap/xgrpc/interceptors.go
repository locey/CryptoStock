package xgrpc

import (
	"bytes"
	"context"
	"fmt"
	"path"
	"time"

	"github.com/golang/protobuf/proto"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"

	"github.com/locey/CryptoStock/StockCoinBase/errcode"
	logging "github.com/locey/CryptoStock/StockCoinBase/logger"
	"github.com/locey/CryptoStock/StockCoinBase/logger/xzap"
)

// PayloadUnaryServerInterceptor 一元服务器拦截器，用于记录服务端请求和响应
func PayloadUnaryServerInterceptor(zapLogger *xzap.ZapLogger) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (_ interface{}, err error) {
		o := evaluateServerOpt(zapLogger.Opts)
		startTime := time.Now()
		newCtx := newServerLoggerCaller(ctx, zapLogger.Logger, info.FullMethod, startTime, o.TimestampFormat())
		defer func() {
			if r := recover(); r != nil {
				err = recoverFrom(newCtx, r, GrpcRecoveryHandlerFunc)
			}
		}()

		resp, err := handler(newCtx, req)
		if !o.ShouldLog(info.FullMethod, err) {
			return resp, err
		}

		fields := protoMessageToFields(req, "grpc.request")
		if err == nil {
			fields = append(fields, protoMessageToFields(resp, "grpc.response")...)
		}
		code := o.CodeFunc(err)
		level := o.LevelFunc(code)
		o.MessageFunc(newCtx, "info", level, err, append(fields, o.DurationFunc(time.Since(startTime))))

		return resp, wrapErr(err)
	}
}

// PayloadStreamServerInterceptor 流拦截器，用于记录服务端请求和响应
func PayloadStreamServerInterceptor(zapLogger *xzap.ZapLogger) grpc.StreamServerInterceptor {
	return func(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) (err error) {
		o := evaluateServerOpt(zapLogger.Opts)
		startTime := time.Now()
		ctx := newServerLoggerCaller(stream.Context(), zapLogger.Logger, info.FullMethod, startTime, o.TimestampFormat())
		wrapped := &wrappedServerStream{ServerStream: stream, wrappedContext: ctx}
		defer func() {
			if r := recover(); r != nil {
				err = recoverFrom(stream.Context(), r, GrpcRecoveryHandlerFunc)
			}
		}()

		err = handler(srv, wrapped)
		if !o.ShouldLog(info.FullMethod, err) {
			return err
		}

		code := o.CodeFunc(err)
		level := o.LevelFunc(code)
		o.MessageFunc(ctx, "info", level, err, []zap.Field{o.DurationFunc(time.Since(startTime))})

		return wrapErr(err)
	}
}

// wrappedServerStream 包装后的服务端流对象
type wrappedServerStream struct {
	grpc.ServerStream
	wrappedContext context.Context
}

// SendMsg 发送消息
func (l *wrappedServerStream) SendMsg(m interface{}) error {
	err := l.ServerStream.SendMsg(m)
	if err == nil {
		addFields(l.Context(), protoMessageToFields(m, "grpc.response")...)
	}

	return wrapErr(err)
}

// RecvMsg 接收消息
func (l *wrappedServerStream) RecvMsg(m interface{}) error {
	err := l.ServerStream.RecvMsg(m)
	if err == nil {
		addFields(l.Context(), protoMessageToFields(m, "grpc.request")...)
	}

	return wrapErr(err)
}

// Context 返回封装的上下文
func (l *wrappedServerStream) Context() context.Context {
	return l.wrappedContext
}

func evaluateServerOpt(opts []xzap.Option) *xzap.Options {
	optCopy := &xzap.Options{}
	*optCopy = *defaultOptions
	for _, o := range opts {
		o(optCopy)
	}

	return optCopy
}

func newServerLoggerCaller(ctx context.Context, logger *zap.Logger, methodString string, start time.Time, timestampFormat string) context.Context {
	var fields []zapcore.Field
	fields = append(fields, zap.String("grpc.start_time", start.Format(timestampFormat)))
	if d, ok := ctx.Deadline(); ok {
		fields = append(fields, zap.String("grpc.request.deadline", d.Format(timestampFormat)))
	}

	if p, ok := peer.FromContext(ctx); ok {
		fields = append(fields, zap.String("grpc.address", p.Addr.String()))
	}

	return xzap.ToContext(ctx, logger.With(append(fields, serverCallFields(methodString)...)...))
}

// serverCallFields 服务端日志fields
func serverCallFields(methodString string) []zapcore.Field {
	service := path.Dir(methodString)[1:]
	method := path.Base(methodString)
	return []zapcore.Field{
		SystemField,
		ServerField,
		zap.String("grpc.service", service),
		zap.String("grpc.method", method),
	}
}

// ------------------------------------- 客户端 ----------------------------------

// PayloadUnaryClientInterceptor 一元拦截器，用于记录客户端端请求和响应
func PayloadUnaryClientInterceptor(zapLogger *xzap.ZapLogger) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, resp interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) (err error) {
		o := evaluateClientOpt(zapLogger.Opts)
		startTime := time.Now()
		newCtx := newClientLoggerCaller(ctx, zapLogger.Logger, method, startTime, o.TimestampFormat())
		defer func() {
			if r := recover(); r != nil {
				err = recoverFrom(newCtx, r, GrpcRecoveryHandlerFunc)
			}
		}()

		err = invoker(newCtx, method, req, resp, cc, opts...)
		if !o.ShouldLog(method, err) {
			return err
		}

		fields := protoMessageToFields(req, "grpc.request")
		if err == nil {
			fields = append(fields, protoMessageToFields(resp, "grpc.response")...)
		}

		level := o.LevelFunc(o.CodeFunc(err))
		duration := o.DurationFunc(time.Since(startTime))
		fields = append(fields, duration)
		o.MessageFunc(newCtx, "info", level, err, fields)

		return err
	}
}

// PayloadStreamClientInterceptor 流拦截器，用于记录客户端请求和响应
func PayloadStreamClientInterceptor(zapLogger *xzap.ZapLogger) grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (_ grpc.ClientStream, err error) {
		o := evaluateClientOpt(zapLogger.Opts)
		startTime := time.Now()
		newCtx := newClientLoggerCaller(ctx, zapLogger.Logger, method, startTime, o.TimestampFormat())
		defer func() {
			if r := recover(); r != nil {
				err = recoverFrom(newCtx, r, GrpcRecoveryHandlerFunc)
			}
		}()

		clientStream, err := streamer(newCtx, desc, cc, method, opts...)
		if !o.ShouldLog(method, err) {
			if err != nil {
				return nil, err
			}

			return &wrappedClientStream{
				ClientStream:   clientStream,
				wrappedContext: newCtx,
			}, err
		}

		level := o.LevelFunc(o.CodeFunc(err))
		var fields []zap.Field
		duration := o.DurationFunc(time.Since(startTime))
		fields = append(fields, duration)
		o.MessageFunc(newCtx, "info", level, err, fields)

		return &wrappedClientStream{
			ClientStream:   clientStream,
			wrappedContext: newCtx,
		}, nil
	}
}

// wrappedClientStream 包装后的客户端流对象
type wrappedClientStream struct {
	grpc.ClientStream
	wrappedContext context.Context
}

// SendMsg 发送消息
func (l *wrappedClientStream) SendMsg(m interface{}) error {
	err := l.ClientStream.SendMsg(m)
	if err == nil {
		addFields(l.Context(), protoMessageToFields(m, "grpc.request")...)
	}

	return wrapErr(err)
}

// RecvMsg 接收消息
func (l *wrappedClientStream) RecvMsg(m interface{}) error {
	err := l.ClientStream.RecvMsg(m)
	if err == nil {
		addFields(l.Context(), protoMessageToFields(m, "grpc.response")...)
	}

	return wrapErr(err)
}

// Context 返回封装的上下文, 用于覆盖 grpc.ServerStream.Context()
func (l *wrappedClientStream) Context() context.Context {
	return l.wrappedContext
}

type protoMessageObject struct {
	pb proto.Message
}

// MarshalLogObject 序列化成日志对象
func (j *protoMessageObject) MarshalLogObject(oe zapcore.ObjectEncoder) error {
	return oe.AddReflected("content", j)
}

// MarshalJSON 序列化成json
func (j *protoMessageObject) MarshalJSON() ([]byte, error) {
	b := &bytes.Buffer{}
	if err := JsonPbMarshaller.Marshal(b, j.pb); err != nil {
		return nil, fmt.Errorf("jsonpb serializer failed: %v", err)
	}

	return b.Bytes(), nil
}

// protoMessageToFields 将message序列化成json，并写入存储
func protoMessageToFields(pbMsg interface{}, key string) []zap.Field {
	var fields []zap.Field
	if p, ok := pbMsg.(proto.Message); ok {
		fields = append(fields, zap.Object(key, &protoMessageObject{pb: p}))
	}

	return fields
}

// recoverFrom 恐慌处理
func recoverFrom(ctx context.Context, p interface{}, r logging.RecoveryHandlerContextFunc) error {
	if r == nil {
		return status.Errorf(codes.Internal, "%v", p)
	}
	return r(ctx, p)
}

// wrapErr 返回gRPC状态码包装后的业务错误
func wrapErr(err error) error {
	if err == nil {
		return nil
	}

	switch e := err.(type) {
	case interface{ GRPCStatus() *status.Status }:
		return e.GRPCStatus().Err()
	case *errcode.Err:
		return status.Error(codes.Code(e.Code()), e.Error())
	default:
		return status.Error(codes.Unknown, err.Error())
	}
}

func evaluateClientOpt(opts []xzap.Option) *xzap.Options {
	optCopy := &xzap.Options{}
	*optCopy = *defaultClientOptions
	for _, o := range opts {
		o(optCopy)
	}

	return optCopy
}

// newClientLoggerCaller 新建客户端
func newClientLoggerCaller(ctx context.Context, logger *zap.Logger, methodString string, start time.Time, timestampFormat string) context.Context {
	var fields []zapcore.Field
	fields = append(fields, zap.String("grpc.start_time", start.Format(timestampFormat)))
	if d, ok := ctx.Deadline(); ok {
		fields = append(fields, zap.String("grpc.request.deadline", d.Format(timestampFormat)))
	}

	if p, ok := peer.FromContext(ctx); ok {
		fields = append(fields, zap.String("grpc.address", p.Addr.String()))
	}

	return xzap.ToContext(ctx, logger.With(append(fields, clientLoggerFields(methodString)...)...))
}

// clientLoggerFields 客户端日志fields
func clientLoggerFields(methodString string) []zapcore.Field {
	service := path.Dir(methodString)[1:]
	method := path.Base(methodString)
	return []zapcore.Field{
		SystemField,
		ClientField,
		zap.String("grpc.service", service),
		zap.String("grpc.method", method),
	}
}

// addFields 添加zap Field 到日志中
func addFields(ctx context.Context, fields ...zap.Field) {
	l := xzap.WithContext(ctx)
	l.WithField(fields...)
}
