const router = dep.express.Router();

router.get('/', (req, res) => {
    res.locals.user = req.user;
    req.session.returnTo = '/tags' + req.path;
    res.render('tags');
});

router.get('/variables', (req, res) => {
    res.locals.user = req.user;
    req.session.returnTo = '/tags' + req.path;
    res.render('variables');
});

router.get('/arrays', (req, res) => {
    res.locals.user = req.user;
    req.session.returnTo = '/tags' + req.path;
    res.render('arrays');
});

router.get('/tos', (req, res) => {
    res.locals.user = req.user;
    req.session.returnTo = '/tags' + req.path;
    res.render('tagtos');
});


router.get('/editor', (req, res) => {
    res.locals.user = req.user;
    req.session.returnTo = '/tags' + req.path;

    res.locals.startText = `{//;Start by typing an opening brace.
Documentation is available here: https://blargbot.xyz/tags/ }`;
    renderEditor(req, res);
});

router.post('/editor', (req, res) => {
    res.locals.user = req.user;
    req.session.returnTo = '/tags' + req.path;
    res.locals.startText = `{//;Start by typing an opening brace.
Documentation is available here: https://blargbot.xyz/tags/ }`;
    renderEditor(req, res);
});

async function renderEditor(req, res) {
    if (!req.user) {
        res.locals.message = 'You are not logged in. In order to use the save, rename, and delete features, please log in! \nNote: this will delete any work done in the editor.';
        res.redirect('/login');
        return;
    }
    let guilds = req.user.guilds;

    guilds = guilds.filter(g => {
        return bot.guilds.get(g.id) != undefined;
    });
    guilds = await Promise.filter(guilds, async function (g) {
        return await bu.isUserStaff(req.user.id, g.id);
    });
    res.locals.guilds = guilds.map(g => {
        return { name: g.name, id: g.id };
    });



    if (req.body && req.body.action) {
        let destination = req.body.destination || false;
        res.locals.destination = req.body.destination;
        let title, storedTag, storedGuild;
        if (destination && await bu.isUserStaff(req.user.id, destination)) {
            storedGuild = await bu.getGuild(destination);
        }
        title = (req.body.tagName || '').replace(/[^\d\w .,\/#!$%\^&\*;:{}=\-_~()@\[\]]/gi, '');

        async function saveCcommand(tag, name) {
            storedGuild.ccommands[name || title] = tag;
            await r.table('guild').get(destination).update({
                ccommands: r.literal(storedGuild.ccommands)
            });
        }

        switch (req.body.action) {
            case 'load':
                if (title) {
                    if (!storedGuild)
                        storedTag = await r.table('tag').get(title).run();
                    else {
                        storedTag = storedGuild.ccommands[title];
                        if (storedTag && typeof storedTag == 'string')
                            storedTag = {
                                content: storedTag
                            };
                    }
                    if (storedTag) res.locals.startText = storedTag.content;
                }
                res.locals.tagName = title;
                break;
            case 'save':
                res.locals.startText = req.body.content;
                res.locals.tagName = title;
                if (title == '') {
                    res.locals.error = 'Blank is not a name!';
                } else {
                    if (!storedGuild) {
                        storedTag = await r.table('tag').get(title).run();
                    } else {
                        storedTag = storedGuild.ccommands[title];
                        if (storedTag && typeof storedTag == 'string')
                            storedTag = {
                                content: storedTag
                            };
                    }
                    if (storedTag) {
                        if (!storedGuild && storedTag.author != req.user.id)
                            res.locals.error = 'You do not own this tag!';
                        else {
                            if (!storedGuild) {
                                await r.table('tag').get(title).update({
                                    content: req.body.content,
                                    lastmodified: r.now()
                                }).run();
                                res.locals.message = 'Your tag has been edited! It has been saved as \'' + title + '\'.';
                                logChange(req.user, 'Edit (WI)', {
                                    user: `${req.user.username} (${req.user.id})`,
                                    tag: title,
                                    content: req.body.content
                                });
                            } else {
                                await saveCcommand({
                                    content: req.body.content,
                                    author: req.user.id
                                });
                                res.locals.message = 'Your custom command has been edited! It has been saved as \'' + title + '\'.';

                            }
                        }
                    } else {
                        if (!storedGuild) {
                            await r.table('tag').get(title).replace({
                                name: title,
                                author: req.user.id,
                                content: req.body.content,
                                lastmodified: r.now(),
                                uses: 0
                            }).run();
                            res.locals.message = 'Your tag has been created! It has been saved as \'' + title + '\'.';
                            logChange(req.user, 'Create (WI)', {
                                user: `${req.user.username} (${req.user.id})`,
                                tag: title,
                                content: req.body.content
                            });
                        } else {
                            await saveCcommand({
                                content: req.body.content,
                                author: req.user.id
                            });
                            res.locals.message = 'Your custom command has been created! It has been saved as \'' + title + '\'.';
                        }
                    }
                }
                break;
            case 'rename':
                res.locals.startText = req.body.content;
                res.locals.tagName = title;
                let newTitle = req.body.newname.replace(/[^\d\w .,\/#!$%\^&\*;:{}=\-_~()@\[\]]/gi, '');
                if (newTitle == '') {
                    res.locals.error = 'Blank is not a name!';
                } else {
                    if (!storedGuild)
                        storedTag = await r.table('tag').get(title).run();
                    else {
                        storedTag = storedGuild.ccommands[title];
                        if (storedTag && typeof storedTag == 'string')
                            storedTag = {
                                content: storedTag,
                                author: req.user.id
                            };
                    }
                    if (storedTag) {
                        if (!storedGuild) {
                            if (storedTag.author != req.user.id)
                                res.locals.error = 'You do not own this tag!';
                            else {
                                let otherStoredTag = await r.table('tag').get(newTitle).run();
                                if (otherStoredTag)
                                    res.locals.error = 'There is already a tag with that name!';
                                else {
                                    storedTag.name = newTitle;
                                    await r.table('tag').insert(storedTag).run();
                                    await r.table('tag').get(title).delete().run();
                                    res.locals.message = 'Tag successfully renamed to \'' + newTitle + '\'. Note: Only the name has changed. You still need to save if you made changes to the contents.';
                                    res.locals.tagName = newTitle;
                                    logChange(req.user, 'Rename (WI)', {
                                        user: `${req.user.username} (${req.user.id})`,
                                        oldName: title,
                                        newName: newTitle
                                    });
                                }
                            }
                        } else {
                            let storedGuild = await bu.getGuild(destination);
                            if (storedGuild.ccommands[newTitle] != undefined) {
                                res.locals.error = 'There is already a custom command with that name!';
                            } else {
                                await saveCcommand(undefined);
                                await saveCcommand(storedTag, newTitle);
                                res.locals.message = 'Custom command successfully renamed to \'' + newTitle + '\'. Note: Only the name has changed. You still need to save if you made changes to the contents.';
                            }
                        }
                    } else {
                        res.locals.error = 'You cannot rename a tag that doesn\'t exist!';
                    }
                }
                break;
            case 'delete':
                res.locals.startText = req.body.content;
                res.locals.tagName = title;

                if (!storedGuild)
                    storedTag = await r.table('tag').get(title).run();
                else {
                    storedTag = storedGuild.ccommands[title];
                    if (storedTag && typeof storedTag == 'string')
                        storedTag = {
                            content: storedTag,
                            author: req.user.id
                        };
                }
                if (storedTag) {
                    if (!storedGuild) {
                        if (storedTag.author != req.user.id)
                            res.locals.error = 'You do not own this tag!';
                        else {
                            await r.table('tag').get(title).delete().run();
                            res.locals.startText = '';
                            res.locals.tagName = '';
                            res.locals.message = 'Tag successfully deleted! It\'s gone forever!';
                            logChange(req.user, 'Delete (WI)', {
                                user: `${req.user.username} (${req.user.id})`,
                                tag: title,
                                content: req.body.content
                            });
                        }
                    } else {
                        await saveCcommand(undefined);
                        res.locals.message = 'Custom command successfully deleted! It\'s gone forever!';
                    }
                } else {
                    res.locals.error = 'You cannot delete a tag that doesn\'t exist!';
                }
                break;
        }
    }
    res.render('editor');
}

async function logChange(user, action, actionObj) {
    user = await bot.getRESTUser(user.id);
    let actionArray = [];
    for (let key in actionObj) {
        if (actionObj[key].length > 1000) actionObj[key] = actionObj[key].substring(0, 1000) + '... (too long)';
        actionArray.push({
            name: key,
            value: actionObj[key],
            inline: true
        });
    }
    let color = 0x000000;
    switch (action.split(' ')[0].toLowerCase()) {
        case 'create':
            color = 0x0eed24;
            break;
        case 'edit':
            color = 0x6b0eed;
            break;
        case 'delete':
            color = 0xf20212;
            break;
        case 'rename':
            color = 0x02f2ee;
            break;
    }
    bu.send('230810364164440065', {
        embed: {
            title: action,
            color: color,
            fields: actionArray,
            author: {
                name: bu.getFullName(user),
                icon_url: user.avatarURL,
                url: `https://blargbot.xyz/user/${user.id}`
            },
            timestamp: dep.moment(),
            footer: {
                text: 'Web Interface'
            }
        }
    });
}

module.exports = router;