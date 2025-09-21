package gdb

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func TestNewDB(t *testing.T) {
	c := &Config{
		User:     "root",
		Password: "123123",
		Host:     "localhost",
		Port:     4316,
		Database: "test_create_db",
	}
	_, err := NewDB(c)
	assert.NoError(t, err)
}

func TestConfig_CreateDatabase(t *testing.T) {
	c := &Config{
		User:     "root",
		Password: "123123",
		Host:     "localhost",
		Port:     4316,
		Database: "test_create_db",
	}
	assert.NoError(t, c.CreateDatabase())
}

func TestConfig_GetDataSource(t *testing.T) {
	c := &Config{
		User:     "root",
		Password: "123123",
		Host:     "localhost",
		Port:     4316,
		Database: "test_create_db",
	}
	assert.Equal(t,
		"root:123123@tcp(localhost:4316)/test_create_db?charset=utf8mb4&parseTime=True&loc=Local",
		c.GetDataSource(),
	)
}

func TestConfig_GetMySQLConfig(t *testing.T) {
	c := &Config{}
	assert.NotNil(t, c.GetMySQLConfig())
	assert.IsType(t, mysql.Config{}, c.GetMySQLConfig())
}

func TestConfig_GetGormConfig(t *testing.T) {
	c := &Config{}
	assert.NotNil(t, c.GetGormConfig())
	assert.IsType(t, &gorm.Config{}, c.GetGormConfig())
}
