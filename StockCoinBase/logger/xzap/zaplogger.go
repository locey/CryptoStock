package xzap

import (
	"errors"
	"os"
	"path"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"google.golang.org/grpc/codes"
	"gopkg.in/natefinch/lumberjack.v2"

	logging "github.com/locey/CryptoStock/StockCoinBase/logger"
)

const (
	// InfoLevel logs everything
	InfoLevel = iota
	// ErrorLevel includes errors, slows, stacks
	ErrorLevel
	// SevereLevel only log severe messages
	SevereLevel
)

const (
	debugFilename  = "debug.log"
	accessFilename = "access.log"
	errorFilename  = "error.log"
	severeFilename = "severe.log"

	consoleMode = "console"
	volumeMode  = "volume"

	levelInfo   = "info"
	levelError  = "error"
	levelSevere = "severe"

	maxSize   = 30
	maxBackup = 5

	timeFormat = "2006-01-02T15:04:05.000Z07"
)

var (
	// ErrLogPathNotSet is an error that indicates the log path is not set.
	ErrLogPathNotSet = errors.New("log path must be set")
	// ErrLogServiceNameNotSet is an error that indicates that the service name is not set.
	ErrLogServiceNameNotSet = errors.New("log service name must be set")

	logLevel uint32
	logger   *zap.Logger

	once sync.Once
)

// ZapLogger zap日志
type ZapLogger struct {
	Logger *zap.Logger
	Opts   []Option
}

func GetZapLogger() *zap.Logger {
	return logger
}

// SetUp 初始化zap Logger
func SetUp(c logging.LogConf) (*ZapLogger, error) {
	var opts []Option
	var err error
	if len(c.Path) == 0 {
		return nil, ErrLogPathNotSet
	}

	setupLogLevel(c)

	if c.KeepDays == 0 {
		c.KeepDays = 7
	}

	switch c.Mode {
	case consoleMode:
		setupWithConsole()
	case volumeMode:
		if len(c.ServiceName) == 0 {
			return nil, ErrLogServiceNameNotSet
		}

		setupWithFiles(c)
	default:
		setupWithFiles(c)
	}

	if err != nil {
		return nil, err
	}

	return &ZapLogger{
		Logger: logger,
		Opts:   opts,
	}, nil
}

func setupLogLevel(c logging.LogConf) {
	switch c.Level {
	case levelInfo:
		setLevel(InfoLevel)
	case levelError:
		setLevel(ErrorLevel)
	case levelSevere:
		setLevel(SevereLevel)
	}
}

func setLevel(level uint32) {
	atomic.StoreUint32(&logLevel, level)
}

func setupWithConsole() {
	consoleDebugging := zapcore.Lock(os.Stdout)
	core := zapcore.NewTee(
		zapcore.NewCore(getConsoleEncoder(), consoleDebugging, DefaultCodeToLevel(codes.Code(logLevel))),
	)

	once.Do(func() {
		logger = zap.New(core)
	})
}

func setupWithFiles(c logging.LogConf) {
	accessPath := path.Join(c.Path, accessFilename)
	errorPath := path.Join(c.Path, errorFilename)
	severePath := path.Join(c.Path, severeFilename)
	debugPath := path.Join(c.Path, debugFilename)
	infoPriority := zap.LevelEnablerFunc(func(lvl zapcore.Level) bool {
		return lvl == zapcore.InfoLevel
	})
	warnPriority := zap.LevelEnablerFunc(func(lvl zapcore.Level) bool {
		return lvl == zapcore.WarnLevel
	})
	debugPriority := zap.LevelEnablerFunc(func(lvl zapcore.Level) bool {
		return lvl == zapcore.DebugLevel
	})
	errPriority := zap.LevelEnablerFunc(func(lvl zapcore.Level) bool {
		return lvl > zapcore.WarnLevel
	})
	core := zapcore.NewTee(
		zapcore.NewCore(getFileEncoder(), getLogWriter(accessPath, maxSize, maxBackup, c.KeepDays, c.Compress), infoPriority),
		zapcore.NewCore(getFileEncoder(), getLogWriter(errorPath, maxSize, maxBackup, c.KeepDays, c.Compress), errPriority),
		zapcore.NewCore(getFileEncoder(), getLogWriter(severePath, maxSize, maxBackup, c.KeepDays, c.Compress), warnPriority),
		zapcore.NewCore(getFileEncoder(), getLogWriter(debugPath, maxSize, maxBackup, c.KeepDays, c.Compress), debugPriority),
	)

	once.Do(func() {
		logger = zap.New(core)
	})
}

func getLogWriter(fileName string, maxSize, maxBackups, maxAge int, isCompress bool) zapcore.WriteSyncer {
	lumberJackLogger := &lumberjack.Logger{
		Filename:   fileName,
		MaxSize:    maxSize,
		MaxBackups: maxBackups,
		MaxAge:     maxAge,
		Compress:   isCompress,
	}

	return zapcore.AddSync(lumberJackLogger)
}

func getFileEncoder() zapcore.Encoder {
	return zapcore.NewJSONEncoder(zapcore.EncoderConfig{
		TimeKey:        "@timestamp",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		EncodeLevel:    zapcore.LowercaseLevelEncoder,  // Level 序列化为小写字符串
		EncodeTime:     TimeEncoder,                    // 记录时间设置为2006-01-02T15:04:05Z07:00
		EncodeDuration: zapcore.SecondsDurationEncoder, //  耗时设置为浮点秒数
	})
}

func getConsoleEncoder() zapcore.Encoder {
	encoderConfig := zap.NewDevelopmentEncoderConfig()
	encoderConfig.EncodeTime = TimeEncoder
	encoderConfig.EncodeLevel = zapcore.LowercaseLevelEncoder
	encoderConfig.EncodeDuration = zapcore.SecondsDurationEncoder
	encoderConfig.EncodeCaller = zapcore.ShortCallerEncoder
	return zapcore.NewConsoleEncoder(encoderConfig)
}

// TimeEncoder 设置时间格式化方式
func TimeEncoder(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
	enc.AppendString(t.Format(timeFormat))
}
