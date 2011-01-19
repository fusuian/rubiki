# -*- coding: utf-8 -*-
require 'ramaze'
require 'mechanize'
require 'nokogiri'
require 'json'
require 'prettyprint'

describe "ruby.cgi は、" do
  Home = "http://localhost:7070/"

  before do
    @agent = Mechanize.new
  end

  it "index にアクセスすると ruby.cgi index を返す。" do
    page = @agent.get Home + "index"
    page.body.should == "ruby.cgi index"    
  end

  it "compile_ruby で JSON のバイトコードを返す。" do
    page = @agent.post Home + "compile_ruby/hello", { :src => "puts 'hello'"}
    json = JSON.load page.body
    json.should be_a Array
    json[0].should == "YARVInstructionSequence/SimpleDataFormat"
    json[5].should == "<compiled>"
    json[6].should == "hello"
    opcode = json.last
    opcode[0].should == 1
    opcode[-1].should == ["leave"]
  end
  
  it "compile_ruby のソースが空だとエラーメッセージを返す。" do
    page = @agent.post Home + "compile_ruby/hello", { :src => ""}
    page.body.should match /Empty Source Code!/i
    page = @agent.post Home + "compile_ruby/hello"
    page.body.should match /Empty Source Code!/i
  end
  
  it "シンタックスエラーが起きたらそのまま通知する。" do
    src = %Q{File.new("/clean/_cleaned" + filename, w+)}
    page = @agent.post Home + "compile_ruby/error", { :src => src }
    error_msg = page.body
    error_msg.should be_a String
    error_msg.should match /error:1: syntax error/i
  end
end