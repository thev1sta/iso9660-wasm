package main

import (
	"log"
	"os"

	"github.com/thev1sta/iso9660-wasm"
)

func main() {
	wr, err := iso9660.NewWriter()
	if err != nil {
		log.Fatal(err)
	}
	defer func() {
		wr.Cleanup()
	}()

	err = wr.AddFile(os.Stdin, "file")
	if err != nil {
		log.Fatal(err)
	}

	wr.WriteTo(os.Stdout, "github.com/thev1sta/iso9660-wasm")
}
