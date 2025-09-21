package middleware

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httputil"
	"runtime"

	"github.com/gin-gonic/gin"
	"github.com/locey/CryptoStock/StockCoinBase/errcode"
	"github.com/locey/CryptoStock/StockCoinBase/logger/xzap"
	"github.com/locey/CryptoStock/StockCoinBase/xhttp"
)

var (
	dunno     = []byte("???")
	centerDot = []byte("·")
	dot       = []byte(".")
	slash     = []byte("/")
)

// RecoverMiddleware 恐慌捕获恢复处理
func RecoverMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if cause := recover(); cause != nil {
				xzap.WithContext(c.Request.Context()).Errorf("[Recovery] panic recovered, request:%s%v [## stack:]:\n%s", dumpRequest(c.Request), cause, dumpStack(3))
				xhttp.Error(c, errcode.ErrUnexpected)
			}
		}()

		c.Next()
	}
}

// dumpRequest 格式化请求样式
func dumpRequest(req *http.Request) string {
	var dup io.ReadCloser
	req.Body, dup = dupReadCloser(req.Body)

	var b bytes.Buffer
	var err error

	reqURI := req.RequestURI
	if reqURI == "" {
		reqURI = req.URL.RequestURI()
	}

	_, _ = fmt.Fprintf(&b, "%s %s HTTP/%d.%d\n", req.Method, reqURI, req.ProtoMajor, req.ProtoMinor)
	chunked := len(req.TransferEncoding) > 0 && req.TransferEncoding[0] == "chunked"
	if req.Body != nil {
		var n int64
		var dest io.Writer = &b
		if chunked {
			dest = httputil.NewChunkedWriter(dest)
		}
		n, err = io.Copy(dest, req.Body)
		if chunked {
			dest.(io.Closer).Close()
		}
		if n > 0 {
			_, _ = io.WriteString(&b, "\n")
		}
	}

	req.Body = dup
	if err != nil {
		return err.Error()
	}

	return b.String()
}

func dupReadCloser(reader io.ReadCloser) (io.ReadCloser, io.ReadCloser) {
	var buf bytes.Buffer
	tee := io.TeeReader(reader, &buf)
	return ioutil.NopCloser(tee), ioutil.NopCloser(&buf)
}

// dumpStack returns a nicely formatted stack frame, skipping skip frames.
func dumpStack(skip int) []byte {
	buf := new(bytes.Buffer) // the returned data
	// As we loop, we open files and read them. These variables record the currently
	// loaded file.
	var lines [][]byte
	var lastFile string
	for i := skip; ; i++ { // Skip the expected number of frames
		pc, file, line, ok := runtime.Caller(i)
		if !ok {
			break
		}
		// Print this much at least.  If we can't find the source, it won't show.
		_, _ = fmt.Fprintf(buf, "%s:%d (0x%x)\n", file, line, pc)
		if file != lastFile {
			data, err := ioutil.ReadFile(file)
			if err != nil {
				continue
			}
			lines = bytes.Split(data, []byte{'\n'})
			lastFile = file
		}

		_, _ = fmt.Fprintf(buf, "\t%s: %s\n", function(pc), source(lines, line))
	}
	return buf.Bytes()
}

// source returns a space-trimmed slice of the n'th line.
func source(lines [][]byte, n int) []byte {
	n-- // in stack trace, lines are 1-indexed but our array is 0-indexed
	if n < 0 || n >= len(lines) {
		return dunno
	}
	return bytes.TrimSpace(lines[n])
}

// function returns, if possible, the name of the function containing the PC.
func function(pc uintptr) []byte {
	fn := runtime.FuncForPC(pc)
	if fn == nil {
		return dunno
	}
	name := []byte(fn.Name())
	if lastslash := bytes.LastIndex(name, slash); lastslash >= 0 {
		name = name[lastslash+1:]
	}
	if period := bytes.Index(name, dot); period >= 0 {
		name = name[period+1:]
	}
	name = bytes.Replace(name, centerDot, dot, -1)
	return name
}
