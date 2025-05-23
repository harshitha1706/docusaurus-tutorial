import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docusaurus-tutorial/blog',
    component: ComponentCreator('/docusaurus-tutorial/blog', 'cb3'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/archive',
    component: ComponentCreator('/docusaurus-tutorial/blog/archive', '8c4'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/authors',
    component: ComponentCreator('/docusaurus-tutorial/blog/authors', '21b'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/authors/all-sebastien-lorber-articles',
    component: ComponentCreator('/docusaurus-tutorial/blog/authors/all-sebastien-lorber-articles', 'a4a'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/authors/yangshun',
    component: ComponentCreator('/docusaurus-tutorial/blog/authors/yangshun', '06b'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/first-blog-post',
    component: ComponentCreator('/docusaurus-tutorial/blog/first-blog-post', '7db'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/long-blog-post',
    component: ComponentCreator('/docusaurus-tutorial/blog/long-blog-post', 'f35'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/mdx-blog-post',
    component: ComponentCreator('/docusaurus-tutorial/blog/mdx-blog-post', '635'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/tags',
    component: ComponentCreator('/docusaurus-tutorial/blog/tags', '5db'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/tags/docusaurus',
    component: ComponentCreator('/docusaurus-tutorial/blog/tags/docusaurus', '956'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/tags/facebook',
    component: ComponentCreator('/docusaurus-tutorial/blog/tags/facebook', '4c3'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/tags/hello',
    component: ComponentCreator('/docusaurus-tutorial/blog/tags/hello', 'ff7'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/tags/hola',
    component: ComponentCreator('/docusaurus-tutorial/blog/tags/hola', '551'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/blog/welcome',
    component: ComponentCreator('/docusaurus-tutorial/blog/welcome', 'f7e'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/markdown-page',
    component: ComponentCreator('/docusaurus-tutorial/markdown-page', '7e5'),
    exact: true
  },
  {
    path: '/docusaurus-tutorial/docs',
    component: ComponentCreator('/docusaurus-tutorial/docs', '6a6'),
    routes: [
      {
        path: '/docusaurus-tutorial/docs',
        component: ComponentCreator('/docusaurus-tutorial/docs', '7e3'),
        routes: [
          {
            path: '/docusaurus-tutorial/docs',
            component: ComponentCreator('/docusaurus-tutorial/docs', 'a80'),
            routes: [
              {
                path: '/docusaurus-tutorial/docs/Bronze',
                component: ComponentCreator('/docusaurus-tutorial/docs/Bronze', '405'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/docusaurus-tutorial/docs/data-viz-course-material',
                component: ComponentCreator('/docusaurus-tutorial/docs/data-viz-course-material', '165'),
                exact: true
              },
              {
                path: '/docusaurus-tutorial/docs/Databricks',
                component: ComponentCreator('/docusaurus-tutorial/docs/Databricks', '745'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/docusaurus-tutorial/docs/databricks-advanced-data-engineering',
                component: ComponentCreator('/docusaurus-tutorial/docs/databricks-advanced-data-engineering', '843'),
                exact: true
              },
              {
                path: '/docusaurus-tutorial/docs/databricks-basic-data-engineering',
                component: ComponentCreator('/docusaurus-tutorial/docs/databricks-basic-data-engineering', 'e31'),
                exact: true
              },
              {
                path: '/docusaurus-tutorial/docs/dimensional-modeling-slides',
                component: ComponentCreator('/docusaurus-tutorial/docs/dimensional-modeling-slides', 'c4c'),
                exact: true
              },
              {
                path: '/docusaurus-tutorial/docs/Gold',
                component: ComponentCreator('/docusaurus-tutorial/docs/Gold', 'b15'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/docusaurus-tutorial/docs/intro',
                component: ComponentCreator('/docusaurus-tutorial/docs/intro', '985'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/docusaurus-tutorial/docs/pyspark-program-samples',
                component: ComponentCreator('/docusaurus-tutorial/docs/pyspark-program-samples', '0c0'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/docusaurus-tutorial/docs/relational-modeling-slides',
                component: ComponentCreator('/docusaurus-tutorial/docs/relational-modeling-slides', '5f6'),
                exact: true
              },
              {
                path: '/docusaurus-tutorial/docs/Silver',
                component: ComponentCreator('/docusaurus-tutorial/docs/Silver', 'fad'),
                exact: true,
                sidebar: "tutorialSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/docusaurus-tutorial/',
    component: ComponentCreator('/docusaurus-tutorial/', 'aff'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
