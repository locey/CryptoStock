package xhttp

import (
	"bufio"
	"bytes"
	"errors"
	"net"
	"net/http"
)

// LoggedResponseWriter 日志记录响应写入器
type LoggedResponseWriter struct {
	W    http.ResponseWriter
	R    *http.Request
	Code int
}

// NewLoggedResponseWriter 新建日志记录响应写入器
func NewLoggedResponseWriter(w http.ResponseWriter, r *http.Request) *LoggedResponseWriter {
	return &LoggedResponseWriter{
		W:    w,
		R:    r,
		Code: http.StatusOK,
	}
}

// Flush 实现Flush方法
func (w *LoggedResponseWriter) Flush() {
	if flusher, ok := w.W.(http.Flusher); ok {
		flusher.Flush()
	}
}

// Header 实现Header方法
func (w *LoggedResponseWriter) Header() http.Header {
	return w.W.Header()
}

// Hijack 实现Hijack方法
func (w *LoggedResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacked, ok := w.W.(http.Hijacker); ok {
		return hijacked.Hijack()
	}

	return nil, nil, errors.New("server doesn't support hijacking")
}

// Write 实现Write方法
func (w *LoggedResponseWriter) Write(bytes []byte) (int, error) {
	return w.W.Write(bytes)
}

// WriteHeader 实现WriteHeader方法
func (w *LoggedResponseWriter) WriteHeader(code int) {
	w.W.WriteHeader(code)
	w.Code = code
}

// DetailLoggedResponseWriter 详细日志记录响应写入器
type DetailLoggedResponseWriter struct {
	Writer *LoggedResponseWriter
	Buf    *bytes.Buffer
}

// NewDetailLoggedResponseWriter 新建详细日志记录响应写入器
func NewDetailLoggedResponseWriter(w http.ResponseWriter, r *http.Request) *DetailLoggedResponseWriter {
	return &DetailLoggedResponseWriter{
		Writer: NewLoggedResponseWriter(w, r),
		Buf:    &bytes.Buffer{},
	}
}

// Flush 实现Flush方法
func (w *DetailLoggedResponseWriter) Flush() {
	w.Writer.Flush()
}

// Header 实现Header方法
func (w *DetailLoggedResponseWriter) Header() http.Header {
	return w.Writer.Header()
}

// Hijack 实现Hijack方法
func (w *DetailLoggedResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return w.Writer.Hijack()
}

// Write 实现Write方法
func (w *DetailLoggedResponseWriter) Write(bs []byte) (int, error) {
	w.Buf.Write(bs)
	return w.Writer.Write(bs)
}

// WriteHeader 实现WriteHeader方法
func (w *DetailLoggedResponseWriter) WriteHeader(code int) {
	w.Writer.WriteHeader(code)
}
