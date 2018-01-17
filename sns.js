'use strict';

var parse_feeds = require('./parse_feeds');
var cheerio = require('cheerio');
var expandHomeDir = require('expand-home-dir');
var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var request = require('request');
//request = request.defaults({jar: true});
//require('request-debug')(request);
var readlineSync = require('readline-sync');
var imgur = require('imgur');
var urljoin = require('url-join');
var naturalSort = require('javascript-natural-sort');
var wrap = require('word-wrap');

function reset_date(d) {
  d.setHours(0);
  d.setMinutes(0);
  d.setSeconds(0);
  d.setMilliseconds(0);
}

function parse_timestamp(timestamp) {
  var d = new Date();
  reset_date(d);

  var year = parseInt("20" + timestamp.slice(0, 2), 10);
  d.setYear(year);

  var month = parseInt(timestamp.slice(2, 4), 10) - 1;
  d.setMonth(month);

  var date = parseInt(timestamp.slice(4, 6), 10);
  d.setDate(date);

  return d;
}

/*function get_feed_urls(feed) {
  if (!feed) {
    console.log("can't find feed");
    return;
  }

  var ret = [];

  if (!feed.$$parent) {
    ret.push(feed.url);
  } else {
    for (var child in feed) {
      ret.push.apply(ret, get_feed_urls(feed[child]));
    }
  }

  var newret = [];
  ret.forEach((value) => {
    if (value)
      newret.push(value);
  });

  return newret;
}

function find_feed(feed, name) {
  if (feed.name === name)
    return feed;

  if (feed.$$parent) {
    for (var child in feed) {
      if (child === name)
        return feed[child];

      var value = find_feed(feed[child], name);
      if (value)
        return value;
    }
  }

  return null;
  }*/

function find_members_by_group(members, group) {
  var ret = [];
  var ignore = parse_feeds.feeds_toml.general.ignore_sns || [];

  for (var i = 0; i < members.length; i++) {
    var member = members[i];

    if (!member || ignore.indexOf(get_username_from_rssit_url(member.obj.url)) >= 0)
      continue;

    if (member.alt !== group &&
        member.group !== group) {
      continue;
    }

    ret.push(member);
  }

  return ret;
}

// from: https://stackoverflow.com/a/11598864/999400
// removes emoji
const non_printable_re = /[\0-\x1F\x7F-\x9F\xAD\u0378\u0379\u037F-\u0383\u038B\u038D\u03A2\u0528-\u0530\u0557\u0558\u0560\u0588\u058B-\u058E\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u0605\u061C\u061D\u06DD\u070E\u070F\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08A1\u08AD-\u08E3\u08FF\u0978\u0980\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0C00\u0C04\u0C0D\u0C11\u0C29\u0C34\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5A-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C81\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D01\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5F\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F5-\u13FF\u169D-\u169F\u16F1-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191D-\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7-\u1CFF\u1DE7-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2072\u2073\u208F\u209D-\u209F\u20BB-\u20CF\u20F1-\u20FF\u218A-\u218F\u23F4-\u23FF\u2427-\u243F\u244B-\u245F\u2700\u2B4D-\u2B4F\u2B5A-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E3C-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FCD-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA698-\uA69E\uA6F8-\uA6FF\uA78F\uA794-\uA79F\uA7AB-\uA7F7\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FC-\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9E0-\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAA7C-\uAA7F\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F-\uABBF\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE27-\uFE2F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD-\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFFB\uFFFE\uFFFF]/g;

function trim_text(text) {
  if (!text)
    return text;

  return text/*.replace(non_printable_re, "")*/.replace(/^\s+|\s+$/g, '');
}

function get_shortcode_from_url(url) {
  return url.replace(/.*\/p\/([^/?&]*)\/*$/, "$1");
}

function get_instagram_rssit_url(url) {
  return 'http://localhost:8123/f/instagram/raw/p/' + get_shortcode_from_url(url) + "?output=raw";
}

var instagram_username_names = {};

function comment_to_text(comment) {
  var text = "-\n\n[@" + escape_text(comment.owner.username) + "](https://www.instagram.com/" + comment.owner.username + "/)";
  if (comment.owner.username in instagram_username_names) {
    text += " *(" + instagram_username_names[comment.owner.username].toLowerCase() + ")*";
  }
  text += "\n\n" + quote_text(escape_text(comment.text));
  text += "\n\nenglish:\n\n" + quote_text(escape_text(comment.text));
  text += "\n\n";
  return text;
}

function escape_text(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~")
    .replace(/\^/g, "\\^");
}

function quote_text(text) {
  if (trim_text(text) === "")
    return ">-";
  else
    return ">" + wrap(text, {width: 60, indent:'', newline:'\n>'});
}

function get_username_from_rssit_url(url) {
  return url.replace(/.*\/instagram\/u\/([^/?&]*).*$/, "$1");
}

// https://stackoverflow.com/a/28149561
function date_to_isotime(date) {
  var tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(date - tzoffset)).toISOString().slice(0, -1).replace(/\.[0-9]*$/, "");;
}

function do_promise(fn, cb) {
  return new Promise((resolve, reject) => {
    fn().then(
      (data) => {
        cb(data);
        resolve();
      },
      (err) => {
        console.dir(err);
        reject(err);
      }
    );
  });
}

var streamable_username;
var streamable_password;

function upload_video_old(video) {
  if (false) {
    var chance = new require('chance')();
    return new Promise((resolve, reject) => {
      //resolve({video_link:"https://fakestreamable.com/" + chance.string()});
      resolve({shortcode: chance.string()});
    });
  }


  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(video);
    const data = { file: stream, title: path.parse(video).name };
    request('https://api.streamable.com/upload', {
      method: 'POST',
      formData: data,
      auth: {
        username: streamable_username,
        password: streamable_password
      }
    }, (error, response, data) => {
      if (error) {
        console.dir(error);
        reject(error);
        return;
      }
      /*console.dir(error);
      console.dir(data);*/

      resolve(JSON.parse(data));
    });
  });
}

var ranalready = false;
function upload_video(video) {
  /*if (ranalready)
    return;*/
  ranalready = true;
  var apiurl = "https://ajax.streamable.com/";
  var title = path.parse(video).name;
  var jar = request.jar();
  var request_binks = request.defaults({jar: jar});
  return new Promise((resolve, reject) => {
    var stat = fs.statSync(video);
    request_binks(apiurl + "shortcode?size=" + stat.size/* + "&speed=537"*/, {},
            (error, response, data) => {
              if (error) {
                console.dir(error);
                reject(error);
                return;
              }

              var json = JSON.parse(data);
              //console.dir(json);
              var shortcode = json.shortcode;
              var uploadurl = json.url;
              if (uploadurl.startsWith("//"))
                uploadurl = "https:" + uploadurl;
              var token = json.fields.token;
              var basedata = json.options;/*{
                "preset": "mp4",
                "shortcode": shortcode,
                "screenshot": true,
                "upload_source": "web",
                "token": json.fields.token
              };*/
              var transcodereq = false;
              if (!token && json.transcoder_options) {
                //uploadurl = json.transcoder_options.url;
                //token = json.transcoder_options.token;
                basedata = json.fields;
                transcodereq = json.transcoder_options;
              } else {
                basedata.upload_source = "web";
                for (var field in json.fields)
                  basedata[field] = json.fields[field];
                //basedata.token = json.fields.token;
              }
              var fields = json.fields;
              //console.log(uploadurl);
              //console.log(token);
              request_binks(apiurl + "videos/" + shortcode, {
                method: 'PATCH',
                body: {
                  "original_name": title,
                  "original_size": stat.size,
                  "title": title,
                  "upload_source": "web"
                },
                json: true
              }, (error, response, data) => {
                if (error) {
                  console.log("ERR2");
                  console.dir(error);
                  reject(error);
                  return;
                }

                //console.log("2");
                //console.dir(data);

                const stream = fs.createReadStream(video);
                var formdata = basedata;
                formdata["file"] = stream;
                //console.dir(formdata);//{
                  //"file": stream,
                  /*"preset": "mp4",
                  "shortcode": shortcode,
                  "screenshot": true,
                  "upload_source": "web",*/
                  //"token": token
              //};
                      /*for (var key in basedata) {
                  formdata[key] = basedata[key];
                }*/
                //console.dir(formdata);

                request_binks.post({
                  url: uploadurl,
                  //method: 'POST',
                  formData: formdata
                }, (error, response, data) => {
                  //console.log("3");
                  //console.dir(data);
                  if (!transcodereq)
                    resolve({"shortcode": shortcode});
                  else {
                    var reqbody = json.options;
                    for (var key in transcodereq) {
                      reqbody[key] = transcodereq[key];
                    }
                    request_binks.post(apiurl + "transcode/" + shortcode, {
                      body: reqbody,
                      json: true
                    }, (error, response, data) => {
                      if (error) {
                        console.log("ERROR");
                        console.dir(err);
                      }
                      //console.log("4");
                      //console.dir(data);
                      resolve({"shortcode": shortcode});
                    });
                  }
                });
              });
            });
  });
}

var uploaded_images = [];
var images_times_ran = 0;

function upload_images(images) {
  images_times_ran++;
  if (false) {
    var chance = new require('chance')();
    if (images.length === 1) {
      return new Promise((resolve, reject) => {
        resolve({data:{link:"https://fakeimgur.com/" + chance.string(),deletehash:chance.string()}});
      });
    } else {
      return new Promise((resolve, reject) => {
        resolve({data:{id: chance.string()}});
      });
    }

    return;
  }

  return new Promise((resolve, reject) => {
    var promises = [];

    var our_album = null;
    var promise = null;
    if (images.length > 1) {
      if (images !== uploaded_images)
        promise = imgur.createAlbum();
      else {
        // 2, including this time
        if (uploaded_images.length === 0 || images_times_ran <= 2) {
          resolve(null);
          return null;
        }

        //new Promise((resolve, reject) => {
          imgur._getAuthorizationHeader().then((authHeader) => {
            var options  = {
              uri: 'https://api.imgur.com/3/album',
              method: 'POST',
              encoding: 'utf8',
              json: true,
              headers: {
                Authorization: authHeader,
              },
              body: {
                "deletehashes": images.join(",")
              }
            };

            console.dir(options);

            var r = request(options, (err, res, body) => {
              if (err) {
                reject(err);
              } else if (body && !body.success) {
                reject({status: body.status, message: body.data ? body.data.error : 'No body data response'});
              } else {
                resolve(body);
              }
            });
          });
      //});
        return;
      }
    } else {
      promise = new Promise((resolve, reject) => {
        resolve();
      });
    }

    promise.then(
      (album) => {
        our_album = album;
        images.forEach((image) => {
          var readStream = fs.createReadStream(image);
          readStream.on('error', reject);
          var params = {};
          if (album)
            params = {album: album.data.deletehash};

          promises.push(new Promise((resolve, reject) => {
              imgur._imgurRequest('upload', readStream, params).then(
                (data) => {
                  console.log(data.data.deletehash);
                  uploaded_images.push(data.data.deletehash);
                  resolve(data);
                },
                (err) => {
                  reject(err);
                });
          }));
        });

        var newpromise = null;
        if (images.length === 1) {
          newpromise =  promises[0];
        } else {
          newpromise = new Promise((resolve, reject) => {
            Promise.all(promises).then(
              () => {
                resolve(our_album);
              },
              (err) => {
                reject(err);
              }
            );
          });
        }

        newpromise.then(
          (data) => {
            resolve(data);
          },
          (err) => {
            reject(err);
          }
        );
      },
      (err) => {
        reject(err);
      }
    );
  });
}

function process_extra(splitted, extra) {
  console.log("Replacing " + Object.keys(extra).length + " lines");
  /*if ((i - origi) !== extra.length) {
    console.error("Mismatching orig/mod length: " + (i - origi) + "/" + extra.length);
    }*/

  for (var i in extra) {
    splitted[i] = "\n" + extra[i];
  }

  splitted = splitted.join("\n").split("\n");
  var newsplitted = [];
  var lastline = null;
  splitted.forEach((line) => {
    if (trim_text(line) === "" && lastline === "")
      return;

    newsplitted.push(line);
    lastline = trim_text(line);
  });

  return newsplitted.join("\n");
}

function replace_lines(filename, splitted, extra, album) {
  var newtext = process_extra(splitted, extra);

  if (album) {
    newtext = "https://imgur.com/a/" + album.data.id + " - images below as an album\n\n" + newtext;
  }

  console.log(filename + "_mod");
  fs.writeFileSync(filename + "_mod", newtext);
}

function update_file_main(filename, splitted) {
  var key = parse_feeds.feeds_toml.general.encrypt_key;
  var encryptor = require('simple-encryptor')(key);
  streamable_username = parse_feeds.feeds_toml.general.streamable_id;
  streamable_password = encryptor.decrypt(parse_feeds.feeds_toml.general.streamable_pass);

  //imgur.setClientId(parse_feeds.feeds_toml.general.imgur_id);
  imgur.setCredentials(parse_feeds.feeds_toml.general.imgur_user,
                       encryptor.decrypt(parse_feeds.feeds_toml.general.imgur_pass),
                       parse_feeds.feeds_toml.general.imgur_id);

  /*imgur.getCredits().then((credits) => {
    console.dir(credits);
  });*/
  //imgur.setAPIUrl('https://api.imgur.com/3/');

  /*var contents = fs.readFileSync(filename).toString('utf8');
  var splitted = contents.split("\n");*/
  var extra = {};
  var promises = [];
  for (var i = 0; i < splitted.length; i++) {
    if (!splitted[i].match(/^https?:\/\/[^/.]*\.instagram.com\//) &&
        !splitted[i].match(/^https?:\/\/([^/.]*\.)?weibo.com\//)) {
      continue;
    }

    var origi = i;
    i++;
    var images = {};
    var videos = {};
    var story = "";

    if (splitted[i-1].indexOf("://guid.instagram.com") >= 0) {
      story = "story, ";
    }

    for (; i < splitted.length; i++) {
      if (trim_text(splitted[i]).length === 0) {
        break;
      }

      var file = expandHomeDir(splitted[i]);
      if (!fs.existsSync(file)) {
        console.error(file + " does not exist.");
        continue;
      } else {
        var key = i;
        /*console.log(story);
        console.log(key);
        console.log(origi);
        console.log("");*/
        if (story && key === (origi + 1)) {
          key--;
        }
        extra[i] = "";
        if (file.endsWith(".jpg"))
          images[key] = file;
        else if (file.endsWith(".mp4"))
          videos[key] = file;
        else
          console.error("Unknown extension for " + file);
      }
    }

    //console.log(images);
    //console.log(videos);
    //console.log("---");
    //continue;

    ((images, videos, story) => {
      if (images.length === 0 && videos.length === 0) {
        console.log("Need to fetch...");
      } else {
        //var promises = [];
        //var extra = [];

        if (Object.keys(images).length === 1) {
          var key = Object.keys(images)[0];
          //console.log(key);

          promises.push(do_promise(() => {
            //return new Promise(imgur.uploadFile(images[key]);
            return upload_images([images[key]]);
          }, (json) => {
            //console.dir(json);
            console.log("Single image");
            extra[key] = json.data.link + " - " + story + "image";
            //console.dir(extra);
          }));
        } else if (Object.keys(images).length > 1) {
          var key = Object.keys(images)[0];
          for (var y = 1; y < Object.keys(images).length; y++) {
            extra[Object.keys(images)[y]] = "";
          }

          promises.push(do_promise(() => {
            var newimages = [];
            for (var image in images) {
              newimages.push(images[image]);
            }

            return upload_images(newimages);//imgur.uploadAlbum(newimages, "File");
          }, (json) => {
            //console.dir(json);
            console.log("Album");
            extra[key] = "https://imgur.com/a/" + json.data.id + " - " + story + "images";
          }));
        }

        var x_i = 0;
        for (var x in videos) {
          promises.push(((x, x_i) => {
            return new Promise((resolve, reject) => {
              upload_video(videos[x]).then(
                (data) => {
                  //console.dir(data);
                  var text = "https://streamable.com/" + data.shortcode + " - " + story;
                  if (videos.length > 1)
                    text += "video " + (x_i + 1);
                  else
                    text += "video";

                  extra[x] = text;

                  console.log("Video " + x_i + "/" + Object.keys(videos).length);
                  resolve();
                },
                (err) => {
                  reject(err);
                }
              );
            });
          })(x, x_i));
          x_i++;
        }
      }
    })(images, videos, story);
  }

  Promise.all(promises).then(() => {
    upload_images(uploaded_images).then(
        (data) => {
          //console.log(data);
          return data;
        },
        (err) => {
          console.dir(err);
          return null;
        }
    ).then((album_data) => {
      replace_lines(filename, splitted, extra, album_data);
      return;
      console.log("Replacing " + Object.keys(extra).length + " lines");
      /*if ((i - origi) !== extra.length) {
        console.error("Mismatching orig/mod length: " + (i - origi) + "/" + extra.length);
        }*/

      for (var i in extra) {
        splitted[i] = "\n" + extra[i];
      }

      console.log(filename + "_mod");

      // remove duplicate empty lines
      splitted = splitted.join("\n").split("\n");
      var newsplitted = [];
      var lastline = null;
      splitted.forEach((line) => {
        if (trim_text(line) === "" && lastline === "")
          return;

        newsplitted.push(line);
        lastline = trim_text(line);
      });

        //newsplitted.unshift(

      var newtext = newsplitted.join("\n");
      fs.writeFileSync(filename + "_mod", newtext);
    });
  });
}

function update_file(filename) {
  var contents = fs.readFileSync(filename).toString('utf8');
  var splitted = contents.split("\n");
  return update_file_main(filename, splitted);

  var newsplitted = [];
  var promises = [];
  for (var i = 0; i < splitted.length; i++) {
    newsplitted.push(splitted[i]);

    if (!splitted[i].match(/^https?:\/\/[^/.]*\.instagram.com\//)) {
      continue;
    }

    var origi = i;
    i++;
    var have_more = false;

    for (; i < splitted.length; i++) {
      if (trim_text(splitted[i]).length === 0) {
        break;
      }

      have_more = true;
      break;
    }

    i--;

    if (!have_more) {
      var url = splitted[origi];
      console.log("Fetching info for " + url);
      ((i) => {
        promises.push(new Promise((resolve, reject) => {
          request(get_instagram_rssit_url(url),
                  (error, response, body) => {
                    // fixme: replace url with local
                    var node = JSON.parse(body);
                    var newarr = [];
                    if (node.node_images.length > 0)
                      newarr.push(node.node_images.join("\n"));
                    if (node.node_videos.length > 0)
                      node.node_videos.forEach((video) => {
                        newarr.push(video.video);
                      });
                    newarr.push("");

                    for (var x = 0; x < newarr.length; x++) {
                      newsplitted.splice(i + x, 0, newarr[x]);
                    }
                    resolve();
                  });
        }));
      })(i + 1);
    }
  }

  Promise.all(promises).then(() => {
    update_file_main(filename, newsplitted);
  });
}

function main() {
  if (process.argv.length < 4) {
    console.log("groupname start_timestamp");
    return;
  }


  if (process.argv[2] === "encrypt") {
    parse_feeds.read_toml().then(
      () => {
        var key = parse_feeds.feeds_toml.general.encrypt_key;
        var encryptor = require('simple-encryptor')(key);
        console.log(encryptor.encrypt(process.argv[3]));
      }
    );
    return;
  }

  var group = process.argv[2];
  var timestamp = process.argv[3];
  var startdate = parse_timestamp(timestamp);

  var enddate;
  var end_timestamp;
  var create = true;
  if (process.argv.length == 5) {
    end_timestamp = process.argv[4];
    enddate = parse_timestamp(end_timestamp);
    create = false;
  } else {
    enddate = new Date();
    reset_date(enddate);
    enddate = new Date(enddate - 1);
    end_timestamp = parse_feeds.create_timestamp(enddate);
  }

  var basename = group + "_" + timestamp + "_" + end_timestamp + ".txt";

  parse_feeds.parse_feeds(true).then(
    (members) => {
      var basedir = expandHomeDir(parse_feeds.feeds_toml.general.snssavedir);
      var filename = path.join(basedir, basename);
      console.log(filename);

      if (!create) {
        if (!fs.existsSync(filename)) {
          console.log(filename + " doesn't exist");
        }

        imgur._getAuthorizationHeader().then(() => {
          update_file(filename);
        }, (err) => {
          console.dir(err);
        });

        parse_feeds.db.close();
        return;
      }

      if (fs.existsSync(filename)) {
        if (!readlineSync.keyInYNStrict("Do you wish to replace " + filename + "?")) {
          parse_feeds.db.close();
          return;
        }
      }

      //var feed_urls = get_feed_urls(find_feed(parse_feeds.toplevel_feed, group));
      //console.log(feed_urls);
      var important_usernames = [];
      for (var i = 0; i < members.length; i++) {
        if (!members[i])
          continue;

        var url = members[i].obj.url;
        if (url.indexOf("/instagram/") < 0)
          continue;

        var member_username = get_username_from_rssit_url(url);
        important_usernames.push(member_username);

        if (!members[i].nicks)
          continue;

        if (members[i].group && members[i].group !== group)
          instagram_username_names[member_username] = parse_feeds.parse_hangul_first(members[i].group) + " ";
        else
          instagram_username_names[member_username] = "";

        instagram_username_names[member_username] += members[i].nicks[0].roman;
      }

      var group_members = find_members_by_group(members, group);
      var urls = [];
      for (var i = 0; i < group_members.length; i++) {
        urls.push(group_members[i].obj.url);
      }

      parse_feeds.db_content.find({
        url: {
          $in: urls
        },
        created_at: {
          $gte: startdate.getTime(),
          $lt: enddate.getTime()
        }
      }, {sort: {created_at: -1}}).then((content) => {
        //console.dir(content);
        parse_feeds.db.close();

        var mcontent = {};
        for (var i = 0; i < content.length; i++) {
          if (!(content[i].url in mcontent))
            mcontent[content[i].url] = [];

          mcontent[content[i].url].push(content[i]);
        }

        var mentries = {};
        var promises = [];
        var promises_done = 0;
        for (var member_url in mcontent) {
          var nick;
          for (var x = 0; x < group_members.length; x++) {
            if (group_members[x].obj.url === member_url) {
              nick = group_members[x].nicks[0].roman_first;
            }
          }

          mentries[nick] = [];
          var mmember = mcontent[member_url];
          var member_username = get_username_from_rssit_url(mmember[0].url);
          var dl_path = expandHomeDir(path.join(parse_feeds.feeds_toml.general.dldir, "instagram", member_username));
          var items = fs.readdirSync(dl_path);
          items = items.sort(naturalSort);
          for (var x = 0; x < mmember.length; x++) {
            var cereal = cheerio.load(mmember[x].content);
            var text = cheerio(cereal("p")[0]).text();
            var newlines = [];
            var entry = {
              url: mmember[x].link,
              story: false,
              content: null
            };
            var has_nonblank = false;

            if (trim_text(text) === "(n/a)") {
              entry.empty = true;
            }

            text.split("\n").forEach((line) => {
              if (entry.empty)
                return;

              var trimmed_line = trim_text(line);
              if (trimmed_line.startsWith("[STORY]")) {
                entry.story = true;
                line = line.replace(/\[STORY\] */, "");
              } else if (trimmed_line.startsWith("[LIVE]") ||
                         trimmed_line.startsWith("[LIVE REPLAY]")) {
                console.log("Live: " + entry.url + "(" + text + ")");
                entry.live = true;
              }

              line = escape_text(line);

              if (trim_text(line) === "") {
                newlines.push(">-");
              } else {
                newlines.push(quote_text(line));
                //newlines.push(">" + wrap(line, {width: 60, indent:'', newline:'\n>'}));
                has_nonblank = true;
              }
            });

            if (entry.live)
              continue;

            if (has_nonblank) {
              entry.content = newlines.join("\n>\n");
            }

            var entrytext = entry.url;
            if (entry.story) {
              entrytext += " - story\n";
            } else {
              entrytext += "\n";
            }

            //entrytext += get_username_from_rssit_url(mmember[x].url) + ":" + mmember[x].created_at + "\n";

            var igimages = [];
            var igvideos = [];
            cereal("img").each((i, img) => {
              var $this = cheerio(img);
              if (cereal($this.parent("a")).length > 0) {
                igvideos.push(cheerio($this.parent("a")).attr("href").replace(/.*\/\/localhost:[0-9]*\/player\//, ""));
              } else {
                igimages.push($this.attr("src"));
              }
            });

            var starting = "(" + date_to_isotime(mmember[x].created_at);
            var limages = [];
            var lvideos = [];
            items.forEach((item) => {
              if (item.startsWith(starting)) {
                var end = "";
                var igarr = null;
                var larr = null;
                if (item.endsWith(".jpg")) {
                  igarr = igimages;
                  larr = limages;
                  end = ".jpg";
                } else if (item.endsWith(".mp4")) {
                  igarr = igvideos;
                  larr = limages;
                  end = ".mp4";
                } else {
                  console.log("Unknown extension for " + item);
                }

                if (igarr.length > 1) {
                  end = ":" + igarr.length + ")" + end;
                }

                if (!item.endsWith(end))
                  return;

                if (igarr.length === larr.length)
                  return;

                larr.push(path.join(dl_path, item).replace(/^\/home\/[^/]*\//, "~/"));
              }
            });

            if (limages.length > 0)
              entrytext += limages.join("\n") + "\n";
            if (lvideos.length > 0)
              entrytext += lvideos.join("\n") + "\n";

            /*if (cereal("a").length > 0) {
              entrytext += cheerio(cereal("a")[0]).attr("href");
            } else {
              entrytext += cheerio(cereal("img")[0]).attr("src");
            }*/

            //entrytext += "\n";
            if (entry.content)
              entrytext += "\n" + entry.content + "\n\nenglish:\n\n" + entry.content + "\n";

            if (!entry.story) {
              promises.push((function(entry, entrytext, mentries, nick) {
                return new Promise((resolve, reject) => {
                  //console.log(get_instagram_rssit_url(entry.url) + "&count=-1")
                  request(get_instagram_rssit_url(entry.url) + "&count=-1",
                          (error, response, body) => {
                            if (response.statusCode === 500) {
                              // deleted post
                              entrytext = entrytext.replace(/^(https?:\/\/[^/]*instagram.*\/p\/.*)$/m, "$1 - deleted");
                              mentries[nick].push(entrytext);
                              console.log("Comments: " + (++promises_done) + "/" + promises.length + " (n/a)");
                              resolve();
                              return;
                            }

                            /*console.log(entry);
                            console.log(mentries);
                            console.log(nick);*/
                            var node = JSON.parse(body);
                            var comments = node.edge_media_to_comment.edges;
                            var importantcomments = {};

                            function process_comment(comment) {
                              if (comment.created_at in importantcomments)
                                return;

                              importantcomments[comment.created_at] = comment_to_text(comment);

                              var splitted = comment.text.split(" ");
                              splitted.forEach((part) => {
                                if (part[0] === "@") {
                                  do_comments(part.slice(1));
                                }
                              });
                            }

                            function do_comments(user) {
                              for (var j = 0; j < comments.length; j++) {
                                var comment = comments[j].node;
                                if (comment.created_at in importantcomments)
                                  continue;
                                if (important_usernames.indexOf(comment.owner.username) >= 0) {
                                  process_comment(comment);
                                } else if (user && user === comment.owner.username) {
                                  //importantcomments.push(comment_to_text(comment));
                                  process_comment(comment);
                                }/* else if (important_usernames.indexOf(comment.owner.username) >= 0) {
                                  //importantcomments.push(comment_to_text(comment));
                                  process_comment(comment);
                                }*/
                              }
                            }

                            do_comments();

                            if (Object.keys(importantcomments).length > 0) {
                              entrytext += "\n-\n\n*comments*\n\n";

                              for (var key in importantcomments) {
                                entrytext += importantcomments[key];
                              }

                              //entrytext += "-\n\n";
                            }

                            mentries[nick].push(entrytext);
                            console.log("Comments: " + (++promises_done) + "/" + promises.length + " (" + Object.keys(importantcomments).length + "/" + comments.length + "/" + node.edge_media_to_comment.count + ")");
                            resolve();
                          });
                });
              })(entry, entrytext, mentries, nick));
            } else {
              mentries[nick].push(entrytext);
            }
          }
        }

        Promise.all(promises).then(() => {
          var sorted_names = Object.keys(mentries).sort();
          var sorted_entries = [];

          sorted_names.forEach((name) => {
            sorted_entries.push("## " + name.toLowerCase() + "\n\n" + mentries[name].join("\n*****\n\n"));
          });
          var sorted_text = sorted_entries.join("\n*****\n\n");


          try {
            fs.mkdirSync(basedir);
          } catch (err) {
            if (err.code != 'EEXIST') {
              throw err;
            }
          }
          fs.writeFileSync(filename, sorted_text);
          var editor = parse_feeds.feeds_toml.general.editor;
          var editorargs = editor.slice(1);
          editorargs.push(filename);
          spawn(editor[0], editorargs, {
            stdio: 'ignore',
            detached: true
          }).unref();
        });
      });
    },
    (data) => {
      console.error(data);
    }
  );
}

main();
