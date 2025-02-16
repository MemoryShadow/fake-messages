<template>
  <div class="container">
    <Form :label-width="80" inline>
      <FormItem label="收件人">
        <AutoComplete v-model="filters.toAddress"
                      :data="options.toAddresses"
                      @on-change="fetchToAddresses" />
      </FormItem>
      <FormItem label="发件人">
        <AutoComplete v-model="filters.fromAddress"
                      :data="options.fromAddresses"
                      @on-change="fetchFromAddresses" />
      </FormItem>
      <FormItem label="标签">
        <Select v-model="filters.tags" multiple clearable style="width:200px">
          <Option v-for="tag in options.tags" :value="tag" :key="tag">{{ tag }}</Option>
        </Select>
      </FormItem>
      <FormItem label="起始时间">
        <DatePicker v-model="filters.createdAtFrom" type="datetime" placeholder="选择最小时间" style="width: 200px" />
      </FormItem>
      <FormItem label="截止时间">
        <DatePicker v-model="filters.createdAtTo" type="datetime" placeholder="选择最大时间" style="width: 200px" />
      </FormItem>
    </Form>
    <Table :row-class-name="tableRowClassName" :columns="columns" :data="emails"
           @on-row-click="readRow">
      <template slot-scope="{ row }" slot="from">
        <a @click="filters.fromAddress = row.fromAddress">
          {{ toNamedContact(row.fromAddress, row.fromName) }}
        </a>
      </template>
      <template slot-scope="{ row }" slot="to">
        <a @click="filters.toAddress = row.toAddress">
          {{ toNamedContact(row.toAddress, row.toName) }}
        </a>
      </template>
      <template slot-scope="{ row }" slot="tags">
        <Tag v-for="tag in row.tags" :key="tag" @click.native="addTagFilter(tag)">
          {{ tag }}
        </Tag>
      </template>
      <template slot-scope="{ row }" slot="content">
        {{ row.content | plain(row.type) }}
      </template>
      <template slot-scope="{ row }" slot="createdAt">
        {{ row.createdAt | datetime }}
      </template>
      <template slot-scope="{ row }" slot="actions">
        <router-link :to="{ name: 'email', params: { id: row.id } }">查看</router-link>
      </template>
    </Table>
    <br>
    <Page :total="pageInfo.total" :page-size="pageInfo.size" :current="pageInfo.number" @on-change="pageNumberChanged" />
  </div>
</template>

<script>
import axios from 'axios'
import websocket from '@/websocket'
import { toNamedContact } from '@/utils/emails'
import { stripHTMLTags } from '@lib/htmltools.js'

export default {
  name: 'EmailList',
  data() { 
    return {
      columns: [
        {
          title: '收件人',
          slot: 'to'
        },
        {
          title: '发件人',
          slot: 'from'
        },
        {
          title: '标签',
          slot: 'tags'
        },
        {
          title: '主题',
          key: 'subject'
        },
        {
          title: '内容',
          slot: 'content'
        },
        {
          title: '时间',
          slot: 'createdAt'
        },
        {
          title: '动作',
          slot: 'actions'
        }
      ],
      emails: [],
      filters: {
        fromAddress: '',
        toAddress: '',
        tags: [],
        createdAtFrom: undefined,
        createdAtTo: undefined
      },
      pageInfo: {
        number: 1,
        size: 10,
        total: 0
      },
      options: {
        tags: [],
        toAddresses: [],
        fromAddresses: []
      }
    }
  },
  computed: {
    pageParams () {
      return {
        from: (this.pageInfo.number - 1) * this.pageInfo.size + 1,
        size: this.pageInfo.size
      }
    }
  },
  watch: {
    filters: {
      deep: true,
      handler () {
        this.pageInfo.number = 1
        this.fetchEmails()
      }
    }
  },
  methods: {
    toNamedContact,
    pageNumberChanged (newPageNumber) {
      this.pageInfo.number = newPageNumber
      this.fetchEmails()
    },
    fetchEmails () {
      axios.get('/emails', { params: { ...this.pageParams, ...this.filters } })
        .then(response => {
          const data = response.data
          this.emails = data.emails
          this.pageInfo.total = data.total
        })
        .catch(function () {
          console.log('error', arguments);
        })
    },
    fetchToAddresses (filter = '') {
      axios.get('/emails/toAddresses', { params: { filter } })
        .then(({ data: { toAddresses }}) => {
          this.options.toAddresses = toAddresses
        })
        .catch(function () {
          console.log('error', arguments);
        })
    },
    fetchFromAddresses (filter = '') {
      axios.get('/emails/fromAddresses', { params: { filter } })
        .then(({ data: { fromAddresses }}) => {
          this.options.fromAddresses = fromAddresses
        })
        .catch(function () {
          console.log('error', arguments);
        })
    },
    fetchTags () {
      axios.get('/emails/tags')
        .then(({ data: { tags }}) => {
          this.options.tags = tags
        })
        .catch(function () {
          console.log('error', arguments);
        })
    },
    tableRowClassName (row, index) {
      return row.isNew ? 'new-item' : ''
    },
    readRow (_, index) {
      this.emails[index].isNew = false
    },
    isMatchFilters (email) {
      if (this.filters.fromAddress && email.fromAddress !== this.filters.fromAddress) {
        return false
      }
      if (this.filters.toAddress && email.toAddress !== this.filters.toAddress) {
        return false
      }
      if (this.filters.tag && email.tags.indexOf(this.filters.tag) === -1) {
        return false
      }
      if (this.filters.createdAtFrom && new Date(email.createdAt) < this.filters.createdAtFrom) {
        return false
      }
      if (this.filters.createdAtTo && new Date(email.createdAt) > this.filters.createdAtTo) {
        return false
      }
      return true
    },
    addTagFilter (tag) {
      if (this.filters.tags.indexOf(tag) === -1) {
        this.filters.tags.push(tag)
      }
    }
  },
  created () {
    this.fetchEmails()
    this.fetchToAddresses()
    this.fetchFromAddresses()
    this.fetchTags()

    // 因为使用了keep-alive，不需要removeEventListener 之类的操作
    websocket.addEventListener('NewEmail', ({ data: email }) => {
      if (this.isMatchFilters(email)) {
        email.isNew = true
        this.emails.unshift(email)

        if (this.$global.notificating) {
          Notification.requestPermission(status => {
            let body = email.content
            if (email.type === 'html') body = stripHTMLTags(email.content)
            body = body.substr(0, 20)
            const notification = new Notification(`收到一条新邮件`, { body: body })
            notification.onclick = () => {
              this.$router.push({ name: 'email', params: { id: email.id } })
              window.focus()
              email.isNew = false
              notification.close()
            }
          })
        }
      }
    })
  }
}
</script>

<style scoped>
.container {
  min-height: 600px; /* 添加最小高度只为日期选择器能够完整地展示出来 */
}
</style>
