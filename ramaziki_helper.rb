# -*- coding: utf-8 -*-
require 'ramaze'
require 'ramaze/helper/link'

module Ramaze
  module Helper
    module RamazikiHelper
      def menus
        [
        a("Home", :index), 
        a("新着", :changes), 
        a("リスト", :list), 
        a("新規", :create)
        ]
      end
      
      # jQuery mobile のナビゲーションバー
      def navbar
        <<EOS
                <div data-role="navbar">
          <ul>
          #{ menus.map { |m| "<li>#{m}</li>" } * "\n" }
          </ul>
          </div>
EOS
      end
      
      def footer
        %Q(<div id="footer"><hr/><div id="powered">Powered by Ruby #{RUBY_VERSION}</div></div>)
      end
      
      # Innate::Helper::Link#a をコピペ。
      # jQuery mobile のために rel="external" が必要だった。
      def a(text, *args)
        case first = (args.first || text)
        when URI
          href = first.to_s
        when /^\w+:\/\//
          uri = URI(first)
          uri.query = Rack::Utils.escape_html(uri.query)
          href = uri.to_s
        else
          href = args.empty? ? r(text) : r(*args)
        end

        text = Rack::Utils.escape_html(text)
        %(<a href="#{href}" rel="external">#{text}</a>)
      end
    end
  end
end