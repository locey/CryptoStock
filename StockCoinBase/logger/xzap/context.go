package xzap

import (
	"context"
	"fmt"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	logging "github.com/locey/CryptoStock/StockCoinBase/logger"
)

const (
	// customMsg 自定义msg
	customMsg = "custom"
)

type ctxMarker struct{}

// CtxLogger 日志上下文记录器
type CtxLogger struct {
	logger *zap.Logger
	fields []zapcore.Field
	ctx    context.Context
}

var (
	ctxMarkedKey = &ctxMarker{}
)

// ToContext 返回新的上下文并添加日志到上下文用于提取
func ToContext(ctx context.Context, logger *zap.Logger) context.Context {
	l := &CtxLogger{
		logger: logger,
	}

	return context.WithValue(ctx, ctxMarkedKey, l)
}

// WithContext 获取当前上下文日志记录器
func WithContext(ctx context.Context) *CtxLogger {
	l, ok := ctx.Value(ctxMarkedKey).(*CtxLogger)
	if !ok || l == nil {
		return NewContextLogger(ctx)
	}

	l.ctx = ctx

	return l
}

// NewContextLogger 获取当前上下文日志记录器
func NewContextLogger(ctx context.Context) *CtxLogger {
	return &CtxLogger{
		logger: GetZapLogger(),
		ctx:    ctx,
	}
}

// tagsToFields 将上下文中的日志标签转换为zap中的Field
func tagsToFields(ctx context.Context) []zapcore.Field {
	var fields []zapcore.Field
	tags := logging.Extract(ctx)
	for k, v := range tags.Values() {
		fields = append(fields, zap.Any(k, v))
	}
	return fields
}

// Extract 提取xzap中最新的Logger
func (l *CtxLogger) Extract() *zap.Logger {
	fields := tagsToFields(l.ctx)
	fields = append(fields, l.fields...)
	return l.logger.With(fields...)
}

// WithField 添加field
func (l *CtxLogger) WithField(fields ...zap.Field) {
	l.fields = append(l.fields, fields...)
}

// Debug 调用 zap.Logger Debug
func (l *CtxLogger) Debug(msg string, fields ...zap.Field) {
	l.Extract().WithOptions(zap.AddCallerSkip(1)).Debug(msg, fields...)
}

// Info 调用 zap.Logger Info
func (l *CtxLogger) Info(msg string, fields ...zap.Field) {
	l.Extract().WithOptions(zap.AddCallerSkip(1)).Info(msg, fields...)
}

// Warn 调用 zap.Logger Warn
func (l *CtxLogger) Warn(msg string, fields ...zap.Field) {
	l.Extract().WithOptions(zap.AddCallerSkip(1)).Warn(msg, fields...)
}

// Error 调用 zap.Logger Error
func (l *CtxLogger) Error(msg string, fields ...zap.Field) {
	l.Extract().WithOptions(zap.AddCallerSkip(1)).Error(msg, fields...)
}

// Panic 调用 zap.Logger Panic
func (l *CtxLogger) Panic(msg string, fields ...zap.Field) {
	l.Extract().WithOptions(zap.AddCallerSkip(1)).Panic(msg, fields...)
}

// Debugf 调用 zap.Logger Debug
func (l *CtxLogger) Debugf(format string, data ...interface{}) {
	l.Debug(customMsg, zap.String("content", fmt.Sprintf(format, data...)))
}

// Infof 调用 zap.Logger Info
func (l *CtxLogger) Infof(format string, data ...interface{}) {
	l.Info(customMsg, zap.String("content", fmt.Sprintf(format, data...)))
}

// Warnf 调用 zap.Logger Warn
func (l *CtxLogger) Warnf(format string, data ...interface{}) {
	l.Warn(customMsg, zap.String("content", fmt.Sprintf(format, data...)))
}

// Errorf 调用 zap.Logger Error
func (l *CtxLogger) Errorf(format string, data ...interface{}) {
	l.Error(customMsg, zap.String("content", fmt.Sprintf(format, data...)))
}

// Panicf 调用 zap.Logger Panic
func (l *CtxLogger) Panicf(format string, data ...interface{}) {
	l.Error(customMsg, zap.String("content", fmt.Sprintf(format, data...)))
}
