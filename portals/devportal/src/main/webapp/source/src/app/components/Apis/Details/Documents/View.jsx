/* eslint-disable react/no-children-prop */
/*
 * Copyright (c) 2019, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, {
    useState, useEffect, useContext, Suspense, lazy,
} from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Icon from '@material-ui/core/Icon';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import ReactSafeHtml from 'react-safe-html';
import { FormattedMessage, injectIntl } from 'react-intl';
import API from 'AppData/api';
import Settings from 'Settings';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ApiContext } from '../ApiContext';
import Alert from '../../../Shared/Alert';

const ReactMarkdown = lazy(() => import('react-markdown' /* webpackChunkName: "MDReactMarkdown" */));

const styles = (theme) => ({
    root: {
        paddingTop: theme.spacing(2),
        paddingBottom: theme.spacing(2),
    },
    docTitle: {
        fontWeight: 100,
        fontSize: 50,
        color: theme.palette.grey[500],
    },
    docBadge: {
        padding: theme.spacing(1),
        background: theme.palette.primary.main,
        position: 'absolute',
        top: 0,
        marginTop: -22,
        color: theme.palette.getContrastText(theme.palette.primary.main),
    },
    button: {
        padding: theme.spacing(2),
        marginTop: theme.spacing(2),
    },
    displayURL: {
        padding: theme.spacing(2),
        marginTop: theme.spacing(2),
        background: theme.palette.grey[200],
        color: theme.palette.getContrastText(theme.palette.grey[200]),
        display: 'flex',
    },
    displayURLLink: {
        paddingLeft: theme.spacing(2),
    },
    docSummary: {
        marginTop: theme.spacing(2),
        color: theme.palette.text.primary,
    },
    fileAvailability: {
        marginTop: theme.spacing(1),
        marginLeft: theme.spacing(0.8),
    },
});
/**
 *
 *
 * @param {*} props
 * @returns
 */
function View(props) {
    const {
        classes, doc, apiId, intl,
    } = props;
    const { api } = useContext(ApiContext);
    const [code, setCode] = useState('');
    const [isFileAvailable, setIsFileAvailable] = useState(false);
    const restAPI = new API();
    const { skipHtml } = Settings.app.markdown;
    const markdownSyntaxHighlighterProps = Settings.app.markdown.syntaxHighlighterProps || {};
    const { syntaxHighlighterDarkTheme } = Settings.app.markdown;

    const loadContentForDoc = () => {
        const docPromise = restAPI.getInlineContentOfDocument(apiId, doc.documentId);
        docPromise
            .then((dataDoc) => {
                let { text } = dataDoc;

                Object.keys(api).forEach((fieldName) => {
                    // eslint-disable-next-line no-useless-escape
                    const regex = new RegExp('\_\_\_' + fieldName + '\_\_\_', 'g');
                    text = text.replace(regex, api[fieldName]);
                });
                setCode(text);
            })
            .catch((error) => {
                if (process.env.NODE_ENV !== 'production') {
                    console.log(error);
                }
            });
    };

    useEffect(() => {
        if (doc.sourceType === 'MARKDOWN' || doc.sourceType === 'INLINE') loadContentForDoc();
        if (doc.sourceType === 'FILE') {
            const promisedGetContent = restAPI.getFileForDocument(apiId, doc.documentId);
            promisedGetContent
                .then(() => {
                    setIsFileAvailable(true);
                })
                .catch(() => {
                    setIsFileAvailable(false);
                });
        }
    }, [props.doc]);

    /**
     * Download the document related file
     * @param {any} response Response of download file
     */
    const downloadFile = (response) => {
        let fileName = '';
        const contentDisposition = response.headers['content-disposition'];

        if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
            const fileNameReg = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = fileNameReg.exec(contentDisposition);
            if (matches != null && matches[1]) fileName = matches[1].replace(/['"]/g, '');
        }
        const contentType = response.headers['content-type'];
        const blob = new Blob([response.data], {
            type: contentType,
        });
        if (typeof window.navigator.msSaveBlob !== 'undefined') {
            window.navigator.msSaveBlob(blob, fileName);
        } else {
            const URL = window.URL || window.webkitURL;
            const downloadUrl = URL.createObjectURL(blob);

            if (fileName) {
                const aTag = document.createElement('a');
                if (typeof aTag.download === 'undefined') {
                    window.location = downloadUrl;
                } else {
                    aTag.href = downloadUrl;
                    aTag.download = fileName;
                    document.body.appendChild(aTag);
                    aTag.click();
                }
            } else {
                window.location = downloadUrl;
            }

            setTimeout(() => {
                URL.revokeObjectURL(downloadUrl);
            }, 100);
        }
    };
    const handleDownload = () => {
        const promisedGetContent = restAPI.getFileForDocument(apiId, doc.documentId);
        promisedGetContent
            .then((done) => {
                downloadFile(done, document);
            })
            .catch((error) => {
                if (process.env.NODE_ENV !== 'production') {
                    console.log(error);
                    Alert.error(intl.formatMessage({
                        id: 'Apis.Details.Documents.View.error.downloading',
                        defaultMessage: 'Error downloading the file',
                    }));
                }
            });
    };
    return (
        <>
            {(doc.summary && doc.otherTypeName !== '_overview') && (
                <Typography variant='body1' className={classes.docSummary}>
                    {doc.summary}
                </Typography>
            )}

            {doc.sourceType === 'MARKDOWN' && (
                <div className='markdown-content-wrapper'>
                    <Suspense fallback={<CircularProgress />}>
                        <ReactMarkdown
                            skipHtml={skipHtml}
                            children={code}
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({
                                    node, inline, className, children, ...propsInner
                                }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            children={String(children).replace(/\n$/, '')}
                                            style={syntaxHighlighterDarkTheme ? vscDarkPlus : vs}
                                            language={match[1]}
                                            PreTag='div'
                                            {...propsInner}
                                            {...markdownSyntaxHighlighterProps}
                                        />
                                    ) : (
                                        <code className={className} {...propsInner}>
                                            {children}
                                        </code>
                                    );
                                },
                            }}
                        />
                    </Suspense>
                </div>
            )}
            {doc.sourceType === 'INLINE' && <ReactSafeHtml html={code} />}
            {doc.sourceType === 'URL' && (
                <a className={classes.displayURL} href={doc.sourceUrl} target='_blank' rel='noreferrer'>
                    {doc.sourceUrl}
                    <Icon className={classes.displayURLLink}>open_in_new</Icon>
                </a>
            )}
            {doc.sourceType === 'FILE' && (
                <Button
                    variant='contained'
                    color='default'
                    className={classes.button}
                    disabled={!isFileAvailable}
                    onClick={handleDownload}
                >
                    <FormattedMessage id='Apis.Details.Documents.View.btn.download' defaultMessage='Download' />

                    <Icon>arrow_downward</Icon>
                </Button>
            )}
            {doc.sourceType === 'FILE' && !isFileAvailable && (
                <Typography className={classes.fileAvailability}>
                    <FormattedMessage
                        id='Apis.Details.Documents.View.file.availability'
                        defaultMessage='No file available'
                    />
                </Typography>
            )}
        </>
    );
}

View.propTypes = {
    classes: PropTypes.shape({}).isRequired,
    doc: PropTypes.shape({}).isRequired,
    apiId: PropTypes.string.isRequired,
    intl: PropTypes.shape({
        formatMessage: PropTypes.func,
    }).isRequired,
};

export default injectIntl(withStyles(styles)(View));
