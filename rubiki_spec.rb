# -*- coding: utf-8 -*-

# bacon rubyki_spec.rb

require 'pp'
require 'nokogiri'
require 'ramaze/spec/bacon'
require_relative 'rubiki'
Ramaze.start

describe "Rubiki サーバの振る舞い：" do
  behaves_like :rack_test
  
  before do
    $dataDir = "data_spec"
  end
  
  it 'スタートページを表示' do
    $dataDir.should == "data_spec"
    got = get('/')
    got.status.should == 200
    got.headers['Content-Type'].should == 'text/html'
    
    body = Nokogiri(got.body)
    body.at('//title').text.strip.should == RamazikiController.new.index
  end
  
  it "list でABC順リスト" do
    got = get('/list')
    got.status.should == 200
    got.headers['Content-Type'].should == 'text/html'
    
    body = Nokogiri(got.body)
    body.at('//title').text.strip.should == "ページリスト (ABC順)"
  end
  
  it "compile_ruby で Ruby ソースをバイトコードに変換する" do
    got = post '/compile_ruby/hello', "src" => "puts %Q(Hello. World!)"
    got.status.should == 200
    body = JSON.load URI.unescape got.body
    body[0].should.match /YARVInstructionSequence\/SimpleDataFormat/
  end

  it "compile_ruby で Ruby ソースが空ならメッセージを返す" do
    got = post '/compile_ruby/hello', "src" => ""
    got.status.should == 200
    body = JSON.load got.body
    body[0].should.match /empty source code/i
  end
  
  it "compile で Ruby1.9.0 を呼び出してバイトコードを得る" do
    rc = RamazikiController.new
    got = rc.send(:compile, "hello", "puts %Q(Hello. World!)")
    body = JSON.load got[0]
    body[0].should.match /YARVInstructionSequence\/SimpleDataFormat/
  end

  it "require でライブラリのバイトコードを得る" do
    got = post '/modify/require_test', "text" => "puts %Q(Hello. World!)"
    got.status.should == 200
    got = get '/require/require_test'
    got.status.should == 200
    body = JSON.load URI.unescape got.body
    body[0].should.match /YARVInstructionSequence\/SimpleDataFormat/
  end
end


