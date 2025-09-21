package errcode

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// WrapErr 返回gRPC状态码包装后的业务错误
func WrapErr(err error) error {
	if err == nil {
		return nil
	}

	switch e := err.(type) {
	case interface{ GRPCStatus() *status.Status }:
		return e.GRPCStatus().Err()
	case *Err:
		return status.Error(codes.Code(e.Code()), e.Error())
	default:
		return status.Error(codes.Unknown, err.Error())
	}
}

// UnwrapErr 返回gRPC状态码解包后的业务错误
func UnwrapErr(err error) error {
	if err == nil {
		return nil
	}

	s, _ := status.FromError(err)
	c := uint32(s.Code())
	if c == CodeCustom {
		return NewCustomErr(s.Message())
	}

	if e, ok := codeToErr[c]; ok {
		return e
	}

	return err
}

// ErrInterceptor 业务错误服务端一元拦截器
func ErrInterceptor(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
	resp, err := handler(ctx, req)
	return resp, WrapErr(err)
}

// ErrStreamInterceptor 业务错误服务端流拦截器
func ErrStreamInterceptor(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
	err := handler(srv, newWrappedServerStream(ss))
	return WrapErr(err)
}

// ErrClientInterceptor 业务错误客户端一元拦截器
func ErrClientInterceptor(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	err := invoker(ctx, method, req, reply, cc, opts...)
	return UnwrapErr(err)
}

// ErrStreamClientInterceptor 业务错误客户端流拦截器
func ErrStreamClientInterceptor(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	cs, err := streamer(ctx, desc, cc, method, opts...)
	return newWrappedClientStream(cs), UnwrapErr(err)
}

// wrappedServerStream 包装后的服务端流对象
type wrappedServerStream struct {
	grpc.ServerStream
}

// newWrappedServerStream 新建包装后的服务端流对象
func newWrappedServerStream(ss grpc.ServerStream) *wrappedServerStream {
	if existing, ok := ss.(*wrappedServerStream); ok {
		return existing
	}
	return &wrappedServerStream{ServerStream: ss}
}

// SendMsg 发送消息
func (w *wrappedServerStream) SendMsg(m interface{}) error {
	return UnwrapErr(w.ServerStream.SendMsg(m))
}

// RecvMsg 接收消息
func (w *wrappedServerStream) RecvMsg(m interface{}) error {
	return UnwrapErr(w.ServerStream.RecvMsg(m))
}

// wrappedClientStream 包装后的客户端流对象
type wrappedClientStream struct {
	grpc.ClientStream
}

// newWrappedClientStream 新建包装后的客户端流对象
func newWrappedClientStream(cs grpc.ClientStream) *wrappedClientStream {
	if existing, ok := cs.(*wrappedClientStream); ok {
		return existing
	}
	return &wrappedClientStream{ClientStream: cs}
}

// SendMsg 发送消息
func (w *wrappedClientStream) SendMsg(m interface{}) error {
	return UnwrapErr(w.ClientStream.SendMsg(m))
}

// RecvMsg 接收消息
func (w *wrappedClientStream) RecvMsg(m interface{}) error {
	return UnwrapErr(w.ClientStream.RecvMsg(m))
}

// CloseSend 关闭发送流
func (w *wrappedClientStream) CloseSend() error {
	return UnwrapErr(w.ClientStream.CloseSend())
}
