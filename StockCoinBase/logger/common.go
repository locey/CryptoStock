package logging

import (
	"context"
	"io"

	"github.com/golang/protobuf/proto"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/locey/CryptoStock/StockCoinBase/errcode"
)

// LogConf 配置信息
type LogConf struct {
	ServiceName string `toml:"service_name" mapstructure:"service_name" json:"service_name"`
	Mode        string `toml:"mode" json:"mode"`
	Path        string `toml:"path" json:"path"`
	Level       string `toml:"level" json:"level"`
	Compress    bool   `toml:"compress" json:"compress"`
	KeepDays    int    `toml:"keep_days" mapstructure:"keep_days" json:"keep_days"`
}

// ErrorToCode 定义error 映射 code
type ErrorToCode func(err error) codes.Code

// DefaultErrorToCode error映射code
func DefaultErrorToCode(err error) codes.Code {
	if err == nil {
		return codes.OK
	}

	switch e := err.(type) {
	case interface{ GRPCStatus() *status.Status }:
		return status.Code(err)
	case *errcode.Err:
		return codes.Code(e.Code())
	default:
		return codes.Unknown
	}
}

// Decider 决策器 定义抑制拦截器日志的规则
type Decider func(methodName string, err error) bool

// DefaultDeciderMethod 决策器是否记录日志的默认实现，默认是记录日志
func DefaultDeciderMethod(methodName string, err error) bool {
	return true
}

// RecoveryHandlerContextFunc 恐慌捕获处理
type RecoveryHandlerContextFunc func(ctx context.Context, p interface{}) (err error)

// ServerLoggingDecider 自定义是否记录服务端请求响应日志
type ServerLoggingDecider func(ctx context.Context, methodName string, servingObject interface{}) bool

// ClientLoggingDecider 自定义是否记录客户端请求响应日志
type ClientLoggingDecider func(ctx context.Context, methodName string) bool

// JsonPbMarshaler 序列化protobuf消息
type JsonPbMarshaler interface {
	Marshal(out io.Writer, pb proto.Message) error
}
