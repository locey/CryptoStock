package logging

// Logger 日志接口
type Logger interface {
	// Debugf debug
	Debugf(format string, data ...interface{})
	// Infof info
	Infof(format string, data ...interface{})
	// Warnf warn
	Warnf(format string, data ...interface{})
	// Errorf error
	Errorf(format string, data ...interface{})
	// Panicf panic
	Panicf(format string, data ...interface{})
}
