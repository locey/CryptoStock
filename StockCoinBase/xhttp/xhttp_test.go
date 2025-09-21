package xhttp

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestQueries(t *testing.T) {
	r, err := http.NewRequest(http.MethodGet, "http://test.com/api/test?id=1&hash=a&hash=b", nil)
	assert.NoError(t, err)

	assert.Equal(t, "1", Query(r, "id"))
	assert.Equal(t, []string{"1"}, QueryArray(r, "id"))
	assert.Equal(t, "a", Query(r, "hash"))
	assert.Equal(t, []string{"a", "b"}, QueryArray(r, "hash"))
}

func TestParse(t *testing.T) {
	r, err := http.NewRequest(http.MethodPost, "http://localhost:8888/v2/chunk/upload", strings.NewReader(
		`{
    "current_data": "abcdefgh",
    "current_seq": 1,
    "current_size": 8,
    "file_name": "test.txt",
    "file_hash": "ec3f5c9819f41ec8965587553fbe9935ec26ec440c5adc94ff6c10efadeba80f",
    "total_seq": 1,
    "total_size": 8
}`))
	assert.NoError(t, err)
	r.Header.Set("Content-Type", "application/json")
	req := &uploadFileChunkReq{}
	err = Parse(r, req)
	assert.NoError(t, err)
	t.Logf("%+v", req)
}

func TestGetExternalIP(t *testing.T) {
	eip, err := GetExternalIP()
	assert.NoError(t, err)
	assert.NotEmpty(t, eip)
	t.Log(eip)
}

func TestGetInternalIP(t *testing.T) {
	iip := GetInternalIP()
	assert.NotEmpty(t, iip)
	t.Log(iip)
}

type uploadFileChunkReq struct {
	CurrentData string `json:"current_data" validate:"required" label:"当前块数据" extensions:"x-order=000"`                  // 当前块数据（须base64编码）
	CurrentSeq  int64  `json:"current_seq" validate:"required" label:"当前块序号" extensions:"x-order=001"`                   // 当前块序号（从1开始）
	CurrentSize int64  `json:"current_size" validate:"required" label:"当前块大小" extensions:"x-order=002"`                  // 当前块大小
	FileName    string `json:"file_name" validate:"required" label:"文件名" extensions:"x-order=003"`                       // 文件名
	FileHash    string `json:"file_hash" validate:"required,len=64,hexadecimal" label:"文件hash" extensions:"x-order=004"` // 文件hash（sha256(文件内容+文件名称)）
	TotalSeq    int64  `json:"total_seq" validate:"required" label:"总序号" extensions:"x-order=005"`                       // 总序号
	TotalSize   int64  `json:"total_size" validate:"required" label:"总大小" extensions:"x-order=006"`                      // 总大小
}

func TestCopyHttpRequest(t *testing.T) {
	http.HandleFunc("/", copyHttpRequestHandle)

	err := http.ListenAndServe("127.0.0.1:8080", nil)
	t.Log(err)
}

type TestRequest struct {
	ID     int64             `json:"id,omitempty"`     // 请求id
	Method string            `json:"method,omitempty"` // 请求方法
	Params []json.RawMessage `json:"params,omitempty"` // 请求参数
}

func copyHttpRequestHandle(w http.ResponseWriter, r *http.Request) {
	r2, err := CopyHttpRequest(r)
	if err != nil {
		_, _ = w.Write([]byte("err: " + err.Error()))
		return
	}
	var pa1 TestRequest
	pa1.Params = make([]json.RawMessage, 0)
	var pa2 TestRequest
	pa2.Params = make([]json.RawMessage, 0)
	if err := Parse(r, &pa1); err != nil {
		return
	}
	if err := Parse(r2, &pa2); err != nil {
		return
	}
	fmt.Println("param1: ", pa1)
	fmt.Println("param2: ", pa2)
	_, _ = w.Write([]byte("ok"))
}
