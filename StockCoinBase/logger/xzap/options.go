package xzap

import (
	"context"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"google.golang.org/grpc/codes"

	logging "github.com/locey/CryptoStock/StockCoinBase/logger"
)

type Options struct {
	shouldLog       logging.Decider
	codeFunc        logging.ErrorToCode
	levelFunc       CodeToLevel
	durationFunc    DurationToField
	messageFunc     MessageProducer
	timestampFormat string
}

// Option 可选参数
type Option func(*Options)

func NewDefaultOption() *Options {
	return &Options{
		levelFunc:       DefaultCodeToLevel,
		shouldLog:       logging.DefaultDeciderMethod,
		codeFunc:        logging.DefaultErrorToCode,
		durationFunc:    DefaultDurationToField,
		timestampFormat: timeFormat,
	}
}

func NewDefaultClientOption() *Options {
	return &Options{
		levelFunc:       DefaultClientCodeToLevel,
		shouldLog:       logging.DefaultDeciderMethod,
		codeFunc:        logging.DefaultErrorToCode,
		durationFunc:    DefaultDurationToField,
		timestampFormat: timeFormat,
	}
}

func (o *Options) ShouldLog(methodName string, err error) bool {
	return o.shouldLog(methodName, err)
}

func (o *Options) CodeFunc(err error) codes.Code {
	return o.codeFunc(err)
}

func (o *Options) LevelFunc(code codes.Code) zapcore.Level {
	return o.levelFunc(code)
}

func (o *Options) DurationFunc(duration time.Duration) zapcore.Field {
	return o.durationFunc(duration)
}

func (o *Options) MessageFunc(ctx context.Context, msg string, level zapcore.Level, err error, fields []zapcore.Field) {
	o.messageFunc(ctx, msg, level, err, fields)
}

func (o *Options) TimestampFormat() string {
	return o.timestampFormat
}

// WithDecider 自定义拦截器日志是否记录
func WithDecider(f logging.Decider) Option {
	return func(o *Options) {
		o.shouldLog = f
	}
}

// WithLevels 定义gRPC返回码和拦截器日志级别映射
func WithLevels(f CodeToLevel) Option {
	return func(o *Options) {
		o.levelFunc = f
	}
}

// WithCodes 自定义error映射 error code.
func WithCodes(f logging.ErrorToCode) Option {
	return func(o *Options) {
		o.codeFunc = f
	}
}

// WithDurationField 自定义将请求持续时间映射到Zap字段
func WithDurationField(f DurationToField) Option {
	return func(o *Options) {
		o.durationFunc = f
	}
}

// WithMessageProducer 自定义消息格式.
func WithMessageProducer(f MessageProducer) Option {
	return func(o *Options) {
		o.messageFunc = f
	}
}

// WithTimestampFormat 自定义日志字段中发出的时间戳
func WithTimestampFormat(format string) Option {
	return func(o *Options) {
		o.timestampFormat = format
	}
}

// CodeToLevel rpc返回码与zap日志级别映射
type CodeToLevel func(code codes.Code) zapcore.Level

// DefaultCodeToLevel 根据RPC服务端返回码返回zap日志级别
func DefaultCodeToLevel(code codes.Code) zapcore.Level {
	switch code {
	case codes.OK:
		return zap.InfoLevel
	case codes.Canceled:
		return zap.InfoLevel
	case codes.Unknown:
		return zap.ErrorLevel
	case codes.InvalidArgument:
		return zap.InfoLevel
	case codes.DeadlineExceeded:
		return zap.WarnLevel
	case codes.NotFound:
		return zap.InfoLevel
	case codes.AlreadyExists:
		return zap.InfoLevel
	case codes.PermissionDenied:
		return zap.WarnLevel
	case codes.Unauthenticated:
		return zap.InfoLevel // unauthenticated requests can happen
	case codes.ResourceExhausted:
		return zap.WarnLevel
	case codes.FailedPrecondition:
		return zap.WarnLevel
	case codes.Aborted:
		return zap.WarnLevel
	case codes.OutOfRange:
		return zap.WarnLevel
	case codes.Unimplemented:
		return zap.ErrorLevel
	case codes.Internal:
		return zap.ErrorLevel
	case codes.Unavailable:
		return zap.WarnLevel
	case codes.DataLoss:
		return zap.ErrorLevel
	default:
		if code >= 7000 {
			return zap.InfoLevel
		}

		return zap.ErrorLevel
	}
}

// DefaultClientCodeToLevel 根据RPC客户端返回码返回zap日志级别
func DefaultClientCodeToLevel(code codes.Code) zapcore.Level {
	switch code {
	case codes.OK:
		return zap.DebugLevel
	case codes.Canceled:
		return zap.DebugLevel
	case codes.Unknown:
		return zap.InfoLevel
	case codes.InvalidArgument:
		return zap.DebugLevel
	case codes.DeadlineExceeded:
		return zap.InfoLevel
	case codes.NotFound:
		return zap.DebugLevel
	case codes.AlreadyExists:
		return zap.DebugLevel
	case codes.PermissionDenied:
		return zap.InfoLevel
	case codes.Unauthenticated:
		return zap.InfoLevel // unauthenticated requests can happen
	case codes.ResourceExhausted:
		return zap.DebugLevel
	case codes.FailedPrecondition:
		return zap.DebugLevel
	case codes.Aborted:
		return zap.DebugLevel
	case codes.OutOfRange:
		return zap.DebugLevel
	case codes.Unimplemented:
		return zap.WarnLevel
	case codes.Internal:
		return zap.WarnLevel
	case codes.Unavailable:
		return zap.WarnLevel
	case codes.DataLoss:
		return zap.WarnLevel
	default:
		if code >= 7000 {
			return zap.InfoLevel
		}

		return zap.InfoLevel
	}
}

// DurationToField 生成日志持续时间
type DurationToField func(duration time.Duration) zapcore.Field

// DefaultDurationToField 请求持续时间转换为Zap字段
var DefaultDurationToField = DurationToTimeMillisField

// DurationToTimeMillisField 持续时间转换为毫秒并使用key[time_ms]
func DurationToTimeMillisField(duration time.Duration) zapcore.Field {
	return zap.Float32("grpc.duration", durationToMilliseconds(duration))
}

// durationToMilliseconds 时间转换为毫秒级别
func durationToMilliseconds(duration time.Duration) float32 {
	return float32(duration.Nanoseconds()/1000) / 1000
}

// MessageProducer 生成日志消息
type MessageProducer func(ctx context.Context, msg string, level zapcore.Level, err error, fields []zapcore.Field)
