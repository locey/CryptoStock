package errcode

import (
	"errors"
	"go/ast"
	"go/parser"
	"go/token"
	"testing"

	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/locey/CryptoStock/StockCoinBase/kit/convert"
)

func TestCodeToErr(t *testing.T) {
	for c, e := range codeToErr {
		assert.Equal(t, c, e.Code())
	}
}

func TestIsErr(t *testing.T) {
	cases := []struct {
		e      error
		expect bool
	}{
		{e: ErrCustom, expect: true},
		{e: ErrUnexpected, expect: true},
		{e: errors.New("测试错误"), expect: false},
		{e: ErrTokenExpire, expect: true},
		{e: NewErr(7000, "test"), expect: true},
		{e: nil, expect: true},
	}

	for _, c := range cases {
		assert.Equal(t, c.expect, IsErr(c.e))
	}
}

func TestParseErr(t *testing.T) {
	cases := []struct {
		e              error
		expectCode     uint32
		expectHTTPCode int
		expectErr      string
	}{
		{e: ErrCustom, expectCode: 7000, expectHTTPCode: 200, expectErr: "自定义错误"},
		{e: ErrUnexpected, expectCode: 7777, expectHTTPCode: 200, expectErr: "服务器繁忙，请稍后重试"},
		{e: errors.New("测试错误"), expectCode: 7777, expectHTTPCode: 200, expectErr: "服务器繁忙，请稍后重试"},
		{e: ErrTokenExpire, expectCode: 10004, expectHTTPCode: 401, expectErr: "token过期"},
		{e: nil, expectCode: 200, expectHTTPCode: 200, expectErr: "OK"},
		{e: WrapErr(ErrCustom), expectCode: 7000, expectHTTPCode: 200, expectErr: "自定义错误"},
		{e: WrapErr(NewErr(7000, "test 7000 code")), expectCode: 7000, expectHTTPCode: 200, expectErr: "test 7000 code"},
		{e: status.Error(codes.Code(7000), "测试错误"), expectCode: 7000, expectHTTPCode: 200, expectErr: "测试错误"},
	}

	for _, c := range cases {
		e := ParseErr(c.e)
		assert.Equal(t, c.expectCode, e.Code())
		assert.Equal(t, c.expectHTTPCode, e.HTTPCode())
		assert.Equal(t, c.expectErr, e.Error())
	}
}

func TestParseCode(t *testing.T) {
	cases := []struct {
		code       uint32
		expectCode uint32
		expectErr  string
	}{
		{code: 7000, expectCode: 7000, expectErr: "自定义错误"},
		{code: 7777, expectCode: 7777, expectErr: "服务器繁忙，请稍后重试"},
		{code: 200, expectCode: 200, expectErr: "OK"},
		{code: 123, expectCode: 7777, expectErr: "服务器繁忙，请稍后重试"},
	}

	for _, c := range cases {
		e := ParseCode(c.code)
		assert.NotNil(t, e)
		assert.Equal(t, c.expectCode, e.Code())
		assert.Equal(t, c.expectErr, e.Error())
	}
}

func TestCheckErrCode(t *testing.T) {
	fSet := token.NewFileSet()
	f, err := parser.ParseFile(fSet, "./errcode.go", nil, parser.AllErrors)
	assert.NoError(t, err)

	var count int
	for _, decl := range f.Decls {
		if d, ok := decl.(*ast.GenDecl); ok {
			for _, spec := range d.Specs {
				if s, ok := spec.(*ast.ValueSpec); ok {
					for i := 0; i < len(s.Names); i++ {
						v, ok := s.Values[i].(*ast.CallExpr)
						if ok {
							for _, arg := range v.Args {
								var code uint32
								switch a := arg.(type) {
								case *ast.BasicLit:
									if a.Kind == token.INT {
										count++
										code = convert.ToUint32(a.Value)
									}
								case *ast.Ident:
									aa, _ := a.Obj.Decl.(*ast.ValueSpec).Values[0].(*ast.BasicLit)
									if aa.Kind == token.INT {
										count++
										code = convert.ToUint32(aa.Value)
									}
								}
								if code > 0 {
									if _, ok := codeToErr[code]; !ok {
										t.Logf("this code: (%d: %s) is not in the map", code, s.Names[i].Name)
									}
								}
							}
						}
					}
				}
			}
		}
	}

	assert.Equal(t, len(codeToErr), count)
}
