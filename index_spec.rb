# -*- coding: utf-8 -*-
require_relative 'ramaziki'
require 'mechanize'
require 'nokogiri'

describe "index.cgi は、" do
  Home = "http://localhost:7000/"
  DataDir = "data"

  before(:all) do
  end

  before do
    File.open("#{DataDir}/test", "w") {|out| out.print "テスト"}
    File.open("#{DataDir}/#{URI.escape "テスト"}", "w") {|out| out.print "test"}
    @agent = Mechanize.new
  end

  it "index はトップページを表示する" do
    page = @agent.get(URI.join(Home, "index"))
    page.title.should == "Home"
    page.at('h1').inner_text.should == "Rubiki Home"
  end

  it "list はページ一覧を、名前順(大文字小文字は無視)で表示する" do
    page = @agent.get(URI.join(Home, "list"))
    lists = page.at('ul').search('li').map {|e| e.inner_text}
    
    lists.should == lists.sort_by {|s| s.downcase}
  end

#  it "show はページを表示する。" do
#    page = @agent.get(URI.join(Home, "show/test"))
#    page.title.should == "test"
#    href = page.at('div#edit>a').attributes["href"]
#    href.value.should == "/edit/test"
#    page.at('div#content/pre').text.should =~ /テスト/
#
#    page = @agent.get(URI.join(Home, URI::encode("show/テスト")))
#    page.title.should == "テスト"
#    href = page.at('div#edit>a').attributes["href"]
#    href.value.should == URI.encode("/edit/テスト")
#    page.at('pre').text.should =~ /test/
#  end

  it "create は新しいページの名前を入力する。" do
    page = @agent.get(URI.join(Home, "create"))
    @agent.page.form_with(:name => 'create') { |form|
      form["page"].should be_empty
      form.field_with(:name => "page").value = "createtest"
      form.click_button
    }
    @agent.page.form_with(:name => "edit") { |form|
      form.action.should == "/modify/createtest"
      form["text"].should be_empty
    }
  end

  it "edit でページ内容がフォームで編集できる。" do
    @agent.get(URI.join(Home, "edit/test"))
    @agent.page.title.should == "test の編集"
    @agent.page.form_with(:name => "edit") { |form|
      form.action.should == "/modify/test"
      form.field_with(:name => "text").value = "試験"
      form.click_button
    }
    page = @agent.page
    page.title.should == "test の編集"
    page.at('textarea').text.should =~ /試験/
  end

  it "edit でページ内容が変更されてなければ、警告を出す。" do
    @agent.get(URI.join(Home, "edit/test"))
    @agent.page.title.should == "test の編集"
    @agent.page.form_with(:name => "edit") { |form|
      form.action.should == "/modify/test"
      form["text"].should == "テスト"
      form.click_button
    }
    page = @agent.page
    page.title.should == "test の編集"
    page.at('h1').inner_text.should == "test の編集"
    page.at('div#flash_notice').text.should =~ /内容が変更されていません/ 
    @agent.page.form_with(:name => "edit") { |form|
      form.action.should == "/modify/" + URI.encode("test")
      form["text"].should == "テスト"
    }
  end

  it "日本語のページ名でも ちゃんと編集できる。" do
    @agent.get(URI.join(Home, URI.encode("edit/テスト")))
    @agent.page.title.should == "テスト の編集"
    @agent.page.form_with(:name => "edit") { |form|
      form.action.should == URI.encode("/modify/テスト")
      form.field_with(:name => "text").value = "試験"
      form.click_button
    }
    page = @agent.page
    page.title.should == "テスト の編集"
    @agent.page.form_with(:name => "edit") { |form|
      form.action.should == "/modify/" + URI.encode("テスト")
      form["text"].should == "試験"
    }
  end

  it "edit のフォームが空だったら、ページを削除する。" do
    @agent.get(URI.join(Home, "edit/test"))
    page = @agent.page
    page.form_with(:name => "edit") { |form|
      form.field_with(:name => "text").value = ""
      form.click_button
    }
    @agent.page.title.should == "Home"
    @agent.page.at('div#flash_notice').text.should =~ /test を削除しました/ 
    File.exists?("#{DataDir}/test").should_not be_true

    @agent.get(URI.join(Home, URI.encode("edit/テスト")))
    page = @agent.page
    page.form_with(:name => "edit") { |form|
      form.field_with(:name => "text").value = ""
      form.click_button
    }
    @agent.page.at('div#flash_notice').text.should =~ /テスト を削除しました/ 
    File.exists?("#{DataDir}/#{URI.escape "テスト"}").should_not be_true
  end

  it "edit のページ名が空だったら、メッセージを出してHomeに戻る。" do
    page = @agent.get(URI.join(Home, "edit"))
    page.title.should == "Home"
    page.at('h1').inner_text.should == "Rubiki Home"
    page.at('div#flash_error').text.should =~ /ページが指定されていません/
  end

end
